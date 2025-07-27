const tabStates = new Map();
const MAX_HISTORY_ITEMS = 10;

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return url;
  }
}

function storeScanHistory(result) {
  chrome.storage.local.get(["scanHistory"], (res) => {
    const history = res.scanHistory || [];
    history.unshift({
      url: result.url,
      isPhishing: result.isPhishing,
      timestamp: new Date().toLocaleString(),
      reported: false
    });
    
    if (history.length > MAX_HISTORY_ITEMS) {
      history.pop();
    }
    
    chrome.storage.local.set({ scanHistory: history });
  });
}

function injectPopup(tabId, url, isPhishing, isSamePage = false) {
  const hostname = new URL(url).hostname;
  
  if (isPhishing) {
    const popupHTML = `
      <div id="phishing-warning-popup" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #ff4444;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 999999;
        max-width: 400px;
        font-family: Arial, sans-serif;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center;">
            <span style="font-size: 24px; margin-right: 10px;">⚠️</span>
            <h3 style="margin: 0;">PHISHING WARNING!</h3>
          </div>
          <button id="close-popup-btn" style="
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0 5px;
          ">×</button>
        </div>
        <p style="margin: 10px 0;">The website "${hostname}" has been detected as a potential phishing site.</p>
        <div style="display: flex; gap: 10px; margin-top: 15px;">
          <button id="close-tab-btn" style="
            background: white;
            color: #ff4444;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">Close Tab</button>
          <button id="report-btn" style="
            background: white;
            color: #ff4444;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          ">Report</button>
        </div>
      </div>
    `;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (html) => {
        const existingPopup = document.getElementById('phishing-warning-popup');
        if (existingPopup) existingPopup.remove();

        const popup = document.createElement('div');
        popup.innerHTML = html;
        document.body.appendChild(popup);

        document.getElementById('close-popup-btn').addEventListener('click', () => {
          popup.remove();
        });

        document.getElementById('close-tab-btn').addEventListener('click', () => {
          window.close();
        });

        document.getElementById('report-btn').addEventListener('click', () => {
          window.open('https://safebrowsing.google.com/safebrowsing/report_phish/?url=' + encodeURIComponent(window.location.href), '_blank');
        });
      },
      args: [popupHTML]
    });
  } else if (isSamePage) {
    const samePageHTML = `
      <div id="same-page-indicator" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #2196F3;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        z-index: 999999;
        font-family: Arial, sans-serif;
        display: flex;
        align-items: center;
        gap: 5px;
        animation: fadeOut 5s forwards;
      ">
        <span style="font-size: 16px;">🔄</span>
        <span style="font-size: 14px;">Same Website</span>
        <button id="close-samepage-btn" style="
          background: none;
          border: none;
          color: white;
          font-size: 16px;
          cursor: pointer;
          margin-left: 5px;
          padding: 0 5px;
        ">×</button>
      </div>
      <style>
        @keyframes fadeOut {
          0% { opacity: 1; }
          80% { opacity: 1; }
          100% { opacity: 0; }
        }
      </style>
    `;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (html) => {
        const existingPopup = document.getElementById('phishing-warning-popup');
        const existingTick = document.getElementById('safe-url-indicator');
        const existingSamePage = document.getElementById('same-page-indicator');
        if (existingPopup) existingPopup.remove();
        if (existingTick) existingTick.remove();
        if (existingSamePage) existingSamePage.remove();

        const indicator = document.createElement('div');
        indicator.innerHTML = html;
        document.body.appendChild(indicator);

        document.getElementById('close-samepage-btn').addEventListener('click', () => {
          indicator.remove();
        });

        setTimeout(() => {
          indicator.remove();
        }, 5000);
      },
      args: [samePageHTML]
    });
  } else {
    const tickHTML = `
      <div id="safe-url-indicator" style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 999999;
        max-width: 400px;
        font-family: Arial, sans-serif;
        animation: fadeOut 8s forwards;z
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center;">
            <span style="font-size: 24px; margin-right: 10px;">✅</span>
            <h3 style="margin: 0;">Safe</h3>
          </div>
          <button id="close-tick-btn" style="
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0 5px;
          ">×</button>
        </div>
        <p style="margin: 10px 0;">The website "${hostname}" passed all security checks and is marked as secure.</p>
      </div>
      <style>
        @keyframes fadeOut {
          0%   { opacity: 1; }
          90%  { opacity: 1; }
          100% { opacity: 0; display: none; }
        }
      </style>
    `;

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (html) => {
        const existingPopup = document.getElementById('phishing-warning-popup');
        const existingTick = document.getElementById('safe-url-indicator');
        const existingSamePage = document.getElementById('same-page-indicator');
        if (existingPopup) existingPopup.remove();
        if (existingTick) existingTick.remove();
        if (existingSamePage) existingSamePage.remove();

        const tick = document.createElement('div');
        tick.innerHTML = html;
        document.body.appendChild(tick);

        document.getElementById('close-tick-btn').addEventListener('click', () => {
          tick.remove();
        });

        document.getElementById('close-popup-btn').addEventListener('click', () => {
          window.close();
        });


        setTimeout(() => {
          tick.remove();
        }, 5000);
      },
      args: [tickHTML]
    });
  }
}

async function checkForPhishing(url, tabId, isReload = false) {
  try {
    const domain = getDomain(url);
    const tabState = tabStates.get(tabId);
    
    const history = await new Promise((resolve) => {
      chrome.storage.local.get(["scanHistory"], (res) => {
        resolve(res.scanHistory || []);
      });
    });

    if (history.length > 0) {
      const mostRecentDomain = getDomain(history[0].url);
      
      if (mostRecentDomain === domain) {
        if (isReload) {
          injectPopup(tabId, url, history[0].isPhishing, false);
        }
        
        tabStates.set(tabId, {
          domain: domain,
          previousUrl: url
        });
        
        return history[0];
      }
    }

    const trustedDomains = [
      'google.com',
      'openai.com',
      'chatgpt.com',
      'chat.openai.com',
      'microsoft.com',
      'github.com',
      'stackoverflow.com',
      'linkedin.com',
      'facebook.com',
      'twitter.com',
      'youtube.com',
      'amazon.com',
      'netflix.com',
      'spotify.com',
      'reddit.com',
      'wikipedia.org',
      'medium.com',
      'quora.com',
      'dropbox.com',
      'slack.com',
      'discord.com',
      'zoom.us',
      'mozilla.org',
      'apple.com',
      'adobe.com',
      'cloudflare.com'
    ];

    const isTrusted = trustedDomains.some(trustedDomain => domain.includes(trustedDomain));
    if (isTrusted) {
      const result = {
        url,
        isPhishing: false,
        timestamp: new Date().toLocaleString()
      };
      
      storeScanHistory(result);
      injectPopup(tabId, url, false, false);
      
      return result;
    }

    const response = await fetch("http://127.0.0.1:8000/predict_url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: url }),
    });

    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    const isPhishing = data.prediction === 0;

    tabStates.set(tabId, {
      domain: domain,
      previousUrl: url
    });
    
    const result = {
      url,
      isPhishing,
      timestamp: new Date().toLocaleString()
    };

    storeScanHistory(result);
    injectPopup(tabId, url, isPhishing, false);

    return result;
  } catch (error) {
    console.error("Scan error:", error);
    return { error: error.message };
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const debouncedCheck = debounce(checkForPhishing, 500);

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) {
    const isReload = details.transitionType === 'reload';
    debouncedCheck(details.url, details.tabId, isReload);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url) {
      debouncedCheck(tab.url, activeInfo.tabId, false);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCurrentStatus") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const url = tabs[0].url;
      const result = await checkForPhishing(url, tabs[0].id, false);
      sendResponse(result);
    });
    return true;
  } else if (request.action === "getHistory") {
    chrome.storage.local.get(["scanHistory"], (res) => {
      sendResponse(res.scanHistory || []);
    });
    return true;
  }
});

setInterval(() => {
  tabStates.clear();
}, 30 * 60 * 1000);

console.log("Phishing Detector background script started"); 