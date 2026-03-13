import { ProxyMan, ProxyMode } from './proxyman.js';

const init = async () => {
  const setBadge = () => {
    const actualMode = proxyman.proxySettings.mode;
    const fixedProxy = proxyman.getEnabledFixedProxy();
    let text = '';
    let color = null;
    switch (actualMode) {
      case ProxyMode.AUTO_DETECT:
        text = 'auto';
        color = 'navy';
        break;
      case ProxyMode.PAC_SCRIPT:
        text = 'auto';
        color = 'green';
        break;
      case ProxyMode.FIXED_SERVERS:
        text = fixedProxy?.badgeText || '*';
        color = 'green';
        break;
      case ProxyMode.SYSTEM:
        text = 'sys';
        color = 'gray';
        break;
    }
    if (actualMode !== proxyman.options.mode || proxyman.isProxyForeign()) {
      color = 'maroon';
    }
    chrome.action.setBadgeText({ text: text });
    if (color) chrome.action.setBadgeTextColor({ color: color });
  };

  await proxyman.loadOptions();
  await proxyman.loadProxySettings();
  proxyman.listenForOptions(setBadge);
  proxyman.listenForProxySettings(setBadge);

  setBadge();
};

const proxyman = new ProxyMan();

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);
