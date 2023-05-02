document.getElementById("predictBtn").addEventListener("click", processText);
document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("signin").addEventListener("click", signIn);
});
document.getElementById("run-button").addEventListener("click", async () => {
  const accessToken = await fetchAccessToken();
  if (!accessToken) {
    alert("Please sign in to use the Construction Categories Predictor.");
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "fetchData", accessToken: accessToken });
  });
});

function initClient() {
  const clientId = "928581672994-a64l5no0qbprabsq2mp8sfvq54ke34sr.apps.googleusercontent.com";
  const apiKey = "AIzaSyDx2Rqns9GjqBfr3mRH7zxBcioU8WNhHLk";
  const scopes = "https://www.googleapis.com/auth/cloud-platform";

  gapi.client.init({
    apiKey: apiKey,
    clientId: clientId,
    scope: scopes,
  }).then(() => {
    console.log("Google API client initialized.");
    updateSignInStatus();
  }, (error) => {
    console.error("Error initializing Google API Client:", error);
  });
}

function signIn() {
  gapi.auth2.getAuthInstance().signIn();
}

function signOut() {
  gapi.auth2.getAuthInstance().signOut();
}

function updateSignInStatus() {
  const isSignedIn = gapi.auth2.getAuthInstance().isSignedIn.get();
  console.log("Signed in status:", isSignedIn);
  if (isSignedIn) {
    document.getElementById("signInBtn").innerText = "Sign Out";
    document.getElementById("signInBtn").onclick = signOut;
  } else {
    document.getElementById("signInBtn").innerText = "Sign In";
    document.getElementById("signInBtn").onclick = signIn;
  }
}

gapi.load("client:auth2", initClient);

gapi.auth2.getAuthInstance().isSignedIn.listen(updateSignInStatus);
function getAccessToken() {
  return gapi.auth2.getAuthInstance().currentUser.get().getAuthResponse().access_token;
}

function fetchAccessToken() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getAccessToken" }, (response) => {
        resolve(response.accessToken);
      });
    });
  });
}
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
      : "No predictions found.";

    alert(resultText);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}
