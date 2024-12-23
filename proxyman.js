export const ProxyMode = Object.freeze({
  DIRECT: 'direct',
  AUTO_DETECT: 'auto_detect',
  PAC_SCRIPT: 'pac_script',
  FIXED_SERVERS: 'fixed_servers',
  SYSTEM: 'system',
  UNMANAGED: 'unmanaged',
});

export const ProxyScheme = Object.freeze({
  HTTP: 'http',
  HTTPS: 'https',
  SOCKS4: 'socks4',
  SOCSK5: 'socks5',
});

export const RuleType = Object.freeze({
  SHEXP: 'shexp',
  REGEX: 'regex',
  EXACT: 'exact',
});

export const RuleSubject = Object.freeze({
  URL: 'url',
  HOST: 'host',
});

export class ProxyServer {
  constructor() {
    this.scheme = ProxyScheme.HTTP;
    this.host = '';
    this.port = 0;
  }
  static fromObject(o) {
    const self = new this();
    self.setScheme(o.scheme);
    self.host = toString(o.host);
    self.setPort(o.port);
    return self;
  }
  toObject() {
    return Object.assign({}, this);
  }
  getPort() {
    if (this.port) return this.port;
    switch (this.scheme) {
      case ProxyScheme.HTTP: return 80;
      case ProxyScheme.HTTPS: return 443;
      case ProxyScheme.SOCKS4:
      case ProxyScheme.SOCSK5: return 1080;
    }
    return -1;
  }
  equals(other) {
    return this.scheme === other.scheme
        && this.host === other.host
        && this.getPort() === other.getPort();
  }
  setPort(v) {
    this.port = parseInt(toString(v), 10);
  }
  setScheme(v) {
    this.scheme = toEnum(ProxyScheme, v)
  }
  isValid() {
    return this.host.length >= 1
        && (!this.port || (this.port >= 1 && this.port <= 65535));
  }
}

export class ProxyConfig {
  constructor() {
    this.name = '';
    this.badgeText = '';
    this.server = new ProxyServer();
  }
  static fromObject(o) {
    const self = new this();
    self.name = toString(o.name);
    self.badgeText = toString(o.badgeText);
    self.server = ProxyServer.fromObject(o.server);
    return self;
  }
  isValid() {
    return this.name.length >= 1
        && this.name !== ProxyMode.DIRECT
        && this.server.isValid();
  }
  clone() {
    return this.constructor.fromObject(this);
  }
}

export class Rule {
  constructor() {
    this.type = RuleType.SHEXP;
    this.subject = RuleSubject.URL;
    this.pattern = '';
    this.proxyName = ProxyMode.DIRECT;
  }
  static fromObject(o) {
    const self = new this();
    self.setType(o.type);
    self.setSubject(o.subject);
    self.pattern = toString(o.pattern);
    self.proxyName = toString(o.proxyName);
    return self;
  }
  setType(v) {
    this.type = toEnum(RuleType, v);
  }
  setSubject(v) {
    this.subject = toEnum(RuleSubject, v);
  }
  isValid(proxyman) {
    return this.pattern.length >= 1
      && (this.proxyName === ProxyMode.DIRECT
      || proxyman.getProxyByName(this.proxyName));
  }
  clone() {
    return this.constructor.fromObject(this);
  }
}

export class Options {
  constructor() {
    this.mode = ProxyMode.DIRECT;
    this.fixedProxyName = null;
    this.proxies = [];
    this.autoDefault = ProxyMode.DIRECT;
    this.autoRules = [];
  }
  static fromObject(o) {
    const self = new this();
    self.mode = toEnum(ProxyMode, o.mode);
    self.fixedProxyName = toString(o.fixedProxyName);
    self.proxies = toArray(o.proxies).map(p => {
      return ProxyConfig.fromObject(p);
    });
    self.autoDefault = toEnum(ProxyMode, o.autoDefault);
    self.autoRules = toArray(o.autoRules).map(r => {
      return Rule.fromObject(r);
    });
    return self;
  }
  toObject() {
    return JSON.parse(JSON.stringify(this))
  }
  setMode(mode, fixedServerName) {
    this.mode = toEnum(ProxyMode, mode);
    this.fixedProxyName = this.mode === ProxyMode.FIXED_SERVERS
      ? toString(fixedServerName)
      : null;
  }
}

export class ProxyMan {
  constructor() {
    this.options = new Options();
    this.proxySettings = {};
    this.pacSentinel = 'https://github.com/adsr/proxyman';
  }
  async loadOptions() {
    const r = await chrome.storage.sync.get(['options']);
    if (!r || typeof r.options !== 'object' || Object.keys(r.options).length <= 0) return;
    this.options = Options.fromObject(r.options);
    console.log('Loaded options', this.options);
  }
  async loadProxySettings() {
    const details = await chrome.proxy.settings.get({ incognito: false });
    this.proxySettings = details.value;
    console.log('Loaded proxy settings', this.proxySettings);
  }
  listenForProxySettings(cb) {
    const self = this;
    chrome.proxy.settings.onChange.addListener((details) => {
      this.proxySettings = details.value;
      console.log('Loaded proxy settings', this.proxySettings);
      if (cb) cb();
    });
  }
  listenForOptions(cb) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes?.options?.newValue) return;
      this.options = Options.fromObject(changes.options.newValue);
      console.log('Loaded options', this.options);
      if (cb) cb();
    });
  }
  saveOptions() {
    chrome.storage.sync.set({ options: this.options.toObject() });
  }
  async configureProxy() {
    const settings = {};
    const o = this.options;
    const mode = o.mode;
    switch (mode) {
      case ProxyMode.DIRECT:
      case ProxyMode.AUTO_DETECT:
      case ProxyMode.SYSTEM:
        settings.mode = mode;
        break;
      case ProxyMode.PAC_SCRIPT:
        settings.mode = mode;
        settings.pacScript = { data: this.generatePacScript() };
        break;
      case ProxyMode.FIXED_SERVERS:
        settings.mode = mode;
        const proxy = this.getProxyByName(o.fixedProxyName);
        if (!proxy) return;
        settings.rules = { singleProxy: proxy.server.toObject() };
        break;
      case ProxyMode.UNMANAGED:
        chrome.proxy.settings.clear({ scope: 'regular' });
        console.log('Cleared proxy settings');
        return;
    }
    chrome.proxy.settings.set({ value: settings, scope: 'regular' });
    console.log('Set proxy settings', settings);
    await this.loadProxySettings();
  }
  generatePacScript() {
    const autoRulesJson = JSON.stringify(this.options.autoRules);
    const autoDefaultJson = JSON.stringify(this.options.autoDefault);
    const proxyMapJson = JSON.stringify((() => {
      const m = {};
      for (const proxy of this.options.proxies) {
        m[proxy.name] = `${proxy.server.scheme.toUpperCase()} ${proxy.server.host}:${proxy.server.getPort()}`;
      }
      return m;
    })());
    const constsJson = JSON.stringify(Object.assign(
      {}, ProxyMode, RuleType, RuleSubject
    ));
    const code = `
      // ${this.pacSentinel}
      function FindProxyForURL(url, host) {
        const autoRules = ${autoRulesJson};
        const autoDefault = ${autoDefaultJson};
        const proxyMap = ${proxyMapJson};
        const consts = ${constsJson};
        // const log = (s) => console.log(s);
        const log = (s) => alert(s);
        let i = 0;
        for (const rule of autoRules) {
          let subject = null;
          switch (rule.subject) {
            default:
            case consts.URL: subject = url; break;
            case consts.HOST: subject = host; break;
          }
          log(\`Checking \${rule.type}=\${rule.pattern} against subject=\${subject}\`);
          let matched = false;
          try {
            switch (rule.type) {
              case consts.SHEXP: matched = shExpMatch(subject, rule.pattern); break;
              case consts.REGEX: matched = (new RegExp(rule.pattern)).test(subject); break;
              case consts.EXACT: matched = rule.pattern === subject; break;
            }
          } catch (e) {
            log(\`Caught exception while evaluating rule \${i}:\`, e);
          }
          if (matched) {
            log(\`Rule \${i} (\${rule.proxyName}) matched\`);
            if (rule.proxyName === consts.DIRECT) {
              return 'DIRECT';
            } else if (proxyMap[rule.proxyName]) {
              log(\`Returning \${proxyMap[rule.proxyName]}\`);
              return proxyMap[rule.proxyName];
            } else {
              log(\`No proxy named \${rule.proxyName}; using DIRECT\`);
              return 'DIRECT';
            }
          }
          i += 1;
        }
        log(\`Returning default rule: \${autoDefault}\`);
        return autoDefault;
      }
    `;
    console.log(code);
    return code;
  }
  getProxyByName(name) {
    for (const proxy of (this.options?.proxies || [])) {
      if (proxy.name === name) {
        return proxy;
      }
    }
    return null;
  }
  isProxyForeign() {
    return this.isFixedForeign() || this.isPacForeign();
  }
  isPacForeign() {
    const c = this.proxySettings;
    return c?.mode === ProxyMode.PAC_SCRIPT
      && !c?.pacScript?.data?.includes(this.pacSentinel);
  }
  isFixedForeign() {
    const o = this.options;
    const c = this.proxySettings;
    if (c?.mode !== ProxyMode.FIXED_SERVERS) {
      return false;
    }
    for (const proxy of this.options.proxies) {
      if (this.isFixedEnabled(proxy)) {
        return false;
      }
    }
    return true;
  }
  isFixedEnabled(proxy) {
    const c = this.proxySettings;
    if (c.mode !== ProxyMode.FIXED_SERVERS) return false;
    const tmp = ProxyServer.fromObject(c?.rules?.singleProxy || {});
    return proxy.server.equals(tmp);
  }
  getEnabledFixedProxy() {
    const c = this.proxySettings;
    for (const proxy of this.options.proxies) {
      if (this.isFixedEnabled(proxy)) return proxy;
    }
    return null;
  }
}

const toEnum = (ec, value) => {
  for (const v of Object.values(ec)) {
    if (value === v) return v;
  }
  return Object.values(ec)[0];
};

const toString = (v) => {
  if (!v) return '';
  return v.toString();
};

const toStringOrNull = (v) => {
  if (v === null) return v;
  return toString(v);
};

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  return [];
};
