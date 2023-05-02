console.log("Chrome extension content script started.");

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchData") {
    const element = document.querySelector(".fwb.color1");
    const description = document.querySelector(".project-description");
    const combinedText =
      element.textContent.trim() + " " + description.textContent.trim();
    console.log("Combined text:", combinedText);
    sendResponse({ combinedText: combinedText });

    if (request.accessToken) {
      sendToVertexAI(combinedText, request.accessToken);
    }
  }
  return true;
});

async function sendToVertexAI(text, accessToken) {
  const projectId = "928581672994";
  const region = "us-central1";
  const endpointId = "7587778121793798144";
  const apiEndpoint = "us-central1-aiplatform.googleapis.com";
  const apiUrl = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${region}/endpoints/${endpointId}:predict`;

  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
  };

  const payload = {
    "instances": [
      {
        "mimeType": "text/plain",
        "content": text,
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
    console.log("Response data:", responseData);

    const predictions = responseData.predictions || [];
    console.log("Predictions:", predictions);

    const filteredPredictions = predictions.filter((prediction) => prediction > 0.5);
    console.log("Filtered predictions:", filteredPredictions);

    const resultText = filteredPredictions.length
      ? "Categories: " + filteredPredictions.join(", ")
      : "No categories found.";

    const element = document.querySelector(".fwb.color1");
    element.insertAdjacentHTML("afterend", `<p>${resultText}</p>`);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}
