console.log("Chrome extension content script started.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchData") {
    if (request.accessToken) {
      sendToVertexAI(request.accessToken);
    }
  }
  return true;
});

async function sendToVertexAI(accessToken) {
  console.log("Sending text to Vertex AI...");
  const projectId = "agape-db-366818"; //Alternate 928581672994
  const region = "us-central1";
  const endpointId = "7587778121793798144";
  const apiEndpoint = "us-central1-aiplatform.googleapis.com";
  const apiUrl = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${region}/endpoints/${endpointId}:predict`;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };

  const element = document.querySelector(".fwb.color1");
  const description = document.querySelector(".project-description");

  if (!element || !description) {
    console.error("Element or description not found.");
    return;
  }

  const combinedText =
    element.textContent.trim() + " " + description.textContent.trim();
  console.log("Combined text:", combinedText);

  const payload = {
    "instances": [
      {
        "mimeType": "text/plain",
        "content": combinedText,
      },
    ],
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log("Vertex AI response data:", responseData);

    const predictions = responseData.predictions[0].displayNames;
    const confidences = responseData.predictions[0].confidences;

    const predictionsData = predictions.reduce((data, prediction, index) => {
      data[prediction] = confidences[index];
      return data;
    }, {});

    console.log("Predictions data:", predictionsData);


    const locationElements = document.querySelectorAll("tr td.item-title");
    let projectLocation;

    for (const element of locationElements) {
      if (element.innerText.includes("Location")) {
        const locationText = element.nextElementSibling.querySelector(".table-desc").innerText;
        const regex = /([A-Z\s]+,\s[A-Z]+)/;
        const match = locationText.match(regex);
        if (match) {
          projectLocation = match[0];
          break;
        }
      }
    }

    if (!projectLocation) {
      console.error("Location element not found.");
      return;
    }

    const location = projectLocation.trim();
    console.log("Project location:", location);

    sendToBigQueryMLModel(predictionsData, location, accessToken);
    insertPredictions(predictions, confidences);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

// Insert the predictions into the DOM
function insertPredictions(predictions, confidences) {
  console.log("Inserting predictions into the DOM...");
  // Filter the predictions based on the confidences greater than 0.80
  const filteredPredictions = predictions.filter(
    (_, index) => confidences[index] > 0.8
  );

  // Find the last <tr> element on the page
  const trElements = document.getElementsByTagName("tr");
  const lastTr = trElements[trElements.length - 1];

  // Create a new <tr> element
  const newTr = document.createElement("tr");

  // Create a new <td> element with the item title
  const titleTd = document.createElement("td");
  titleTd.innerText = "AI Categories";
  newTr.appendChild(titleTd);

  // Create a new <td> element
  const predictionsTd = document.createElement("td");

  // Create an unordered list for the categories
  const ul = document.createElement("ul");

  // Add each filtered prediction as a list item
  filteredPredictions.forEach((prediction) => {
    const li = document.createElement("li");
    li.innerText = prediction;
    ul.appendChild(li);
  });

  predictionsTd.appendChild(ul);
  newTr.appendChild(predictionsTd);

  // Insert the new <tr> element after the last <tr> on the page
  lastTr.insertAdjacentElement("afterend", newTr);
  console.log("Predictions inserted into the DOM.");
}

// Send the predictions data and location to the BigQuery ML model
async function sendToBigQueryMLModel(predictionsData, location, accessToken) {
  console.log("Sending data to BigQuery ML model...");

  // Query drive times for the project location
  const driveTimesRows = await queryDriveTimes(location, accessToken);

  if (Array.isArray(driveTimesRows)) {
    // Create a dataset combining predictionsData and driveTimes
    const dataset = driveTimesRows.map((row) => {
      const data = { companyName: row.Company };
      Object.assign(data, predictionsData);
      data.driveTime = row.Drive_Time;
      return data;
    });

    // Send dataset to BigQuery ML model
    const mlModelResponse = await sendDatasetToMLModel(dataset, accessToken);

    if (mlModelResponse && Array.isArray(mlModelResponse.rows)) {
      const mlModelRows = mlModelResponse.rows;
      // Insert the ML model results into the DOM
      insertMLModelResults(mlModelRows);
    } else {
      console.error("Error: mlModelResponse.rows is not an array");
    }
  } else {
    console.error("Error: driveTimesRows is not an array");
  }
}

async function queryDriveTimes(location, accessToken) {
  const projectId = "agape-db-366818";
  const datasetId = "Public_Bids";
  const tableName = `${projectId}.${datasetId}.Top_25_Comp_Drive_Times`;
  const apiUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;

  const query = `SELECT Company, Project_Location, SAFE_CAST(drive_time AS FLOAT64) as Drive_Time
  FROM \`${tableName}\`
  WHERE Project_Location = @location`;

  console.log("Drive times query:", query);

  const queryParameters = [
    {
      name: "location",
      parameterType: {
        type: {
          typeKind: "TYPE_STRING",
        },
      },
      parameterValue: {
        stringValue: location,
      },
    },
  ];

  console.log("Drive times query parameters:", queryParameters);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };

  const payload = {
    query: query,
    //queryParameters: queryParameters,
    useLegacySql: false,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log("Drive times query response data:", responseData);

    if (responseData.error) {
      console.error("Error querying drive times:", responseData.error);
      return;
    }

    const driveTimesRows = responseData.rows.map((row) => {
      return {
        Company: row.f[0].v,
        Drive_Time: parseFloat(row.f[2].v),
      };
    });

    console.log("Drive times query results:", driveTimesRows);
    return driveTimesRows;
  } catch (error) {
    console.error("Error querying drive times:", error);
    return;
  }
}



/*
//Query Drive Times Temporary for bugtesting:
async function queryDriveTimes(accessToken) {
  const projectId = "agape-db-366818";
  const datasetId = "Public_Bids";
  const tableName = `${projectId}.${datasetId}.Top_25_Comp_Drive_Times`;
  const apiUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;

  const query = `SELECT Company, Project_Location, SAFE_CAST(drive_time AS FLOAT64) as Drive_Time
  FROM \`${tableName}\`
  WHERE Project_Location = 'Montvale, NJ'`;

  console.log("Drive times query:", query);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };

  const payload = {
    query: query,
    useLegacySql: false,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log("Drive times query response data:", responseData);

    if (responseData.error) {
      console.error("Error querying drive times:", responseData.error);
      return;
    }

    const driveTimesRows = responseData.rows.map((row) => {
      return {
        Company: row.f[0].v,
        Drive_Time: parseFloat(row.f[2].v),
      };
    });

    console.log("Drive times query results:", driveTimesRows);
    return driveTimesRows;
  } catch (error) {
    console.error("Error querying drive times:", error);
    return;
  }
}
*/

async function sendDatasetToMLModel(dataset, accessToken) {
  const projectId = "agape-db-366818";
  const datasetId = "Public_Bids";
  const tableName = `${projectId}.${datasetId}.Top_25_Comp_Drive_Times`;
  const model = `${projectId}.${datasetId}.model`;
  const apiUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;

  const query = `SELECT Company, SUM(predicted_probability) as Score
FROM ML.PREDICT(MODEL \`${model}\`, UNNEST(@dataset) as features)
GROUP BY Company
ORDER BY Score DESC`;

  console.log("ML model query:", query);

  const queryParameters = [
    {
      name: "dataset",
      parameterType: {
        type: {
          typeKind: "TYPE_ARRAY",
          arrayElementType: {
            type: {
              typeKind: "TYPE_STRUCT",
            },
          },
        },
      },
      parameterValue: {
        arrayValues: dataset.map((data) => ({
          structValues: Object.entries(data).reduce(
            (acc, [key, value]) => {
              acc[key] = { value: value.toString() };
              return acc;
            },
            {}
          ),
        })),
      },
    },
  ];

  console.log("ML model query parameters:", queryParameters);

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };

  const payload = {
    query: query,
    queryParameters: queryParameters,
    useLegacySql: false,
  };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();
    console.log("ML model query response data:", responseData);

    if (responseData.error) {
      console.error("Error querying ML model:", responseData.error);
      return;
    }

    const mlModelRows = responseData.rows.map((row) => {
      return {
        Company: row.f[0].v,
        Score: parseFloat(row.f[1].v),
      };
    });

    console.log("ML model query results:", mlModelRows);
    return mlModelRows;
  } catch (error) {
    console.error("Error querying ML model:", error);
    return;
  }
}

function insertMLModelResults(mlModelRows) {
  console.log("Inserting ML model results into the DOM...");

  const trElements = document.getElementsByTagName("tr");
  const lastTr = trElements[trElements.length - 1];

  const newTr = document.createElement("tr");
  const titleTd = document.createElement("td");
  titleTd.innerText = "Top 5 Companies";
  newTr.appendChild(titleTd);

  const contentTd = document.createElement("td");
  const ol = document.createElement("ol");

  mlModelRows.slice(0, 5).forEach((row) => {
    const li = document.createElement("li");
    li.innerText = `${row.Company} (${row.Score.toFixed(2)})`;
    ol.appendChild(li);
  });

  contentTd.appendChild(ol);
  newTr.appendChild(contentTd);

  lastTr.insertAdjacentElement("afterend", newTr);
  console.log("ML model results inserted into the DOM.");
}


 
