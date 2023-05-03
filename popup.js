// Listener for the DOM content to be loaded
document.addEventListener("DOMContentLoaded", function () {
  // Add click event listeners to the buttons
  document.getElementById("signin").addEventListener("click", signIn);
  document.getElementById("run").addEventListener("click", async () => {
    console.log("Attempting to fetch access token...");
    const accessToken = await fetchAccessToken();
    if (!accessToken) {
      alert("Please sign in to use the Construction Categories Predictor.");
      return;
    }

    // Query the active tab in the current window
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      // Send a message to the content script with the access token
      chrome.tabs.sendMessage(tabs[0].id, { action: "fetchData", accessToken: accessToken });
    });
  });
});

// Function to initiate the sign-in process
function signIn() {
  console.log("Starting sign-in process...");
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }
    console.log("Access token (interactive):", token);
  });
}

// Function to fetch the access token
function fetchAccessToken() {
  return new Promise((resolve) => {
    console.log("Fetching access token...");
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        resolve(null);
        return;
      }
      console.log("Access token (non-interactive):", token);
      resolve(token);
    });
  });
}
