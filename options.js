import {
  ProxyConfig,
  ProxyMan,
  ProxyMode,
  ProxyModeLabels,
  ProxyScheme,
  Rule,
  RuleSubject,
  RuleType,
}
from './proxyman.js';

class OptionsPage {
  constructor() {
    this.proxies = [];
    this.autoRules = [];
    this.autoDefault = null;
    this.badgeConfs = {};
  }
  render() {
    const self = this;
    this.renderProxies();
    this.renderRules();
    this.renderBadgeConfs();
    document.querySelectorAll('button, input, select').forEach((el, i) => {
      el.addEventListener(el.tagName === 'BUTTON' ? 'click' : 'input', async (e) => {
        self.resetValidation();
        const el = e.target;
        const index = el.dataset.index;
        switch (el.className) {
          case 'proxy-add':         self.addProxy();                                 break;
          case 'proxy-delete':      self.deleteProxy(index);                         break;
          case 'proxy-revert':      self.revertProxies();                            break;
          case 'proxy-save':        await self.saveProxies();                        break;
          case 'proxy-name':        self.proxies[index].setName(el.value);           break;
          case 'proxy-badge-text':  self.proxies[index].badgeConf.setText(el.value); break;
          case 'proxy-badge-fg':    self.proxies[index].badgeConf.setFg(el.value);   break;
          case 'proxy-badge-bg':    self.proxies[index].badgeConf.setBg(el.value);   break;
          case 'proxy-host':        self.proxies[index].server.setHost(el.value);    break;
          case 'proxy-port':        self.proxies[index].server.setPort(el.value);    break;
          case 'proxy-scheme':      self.proxies[index].server.setScheme(el.value);  break;
          case 'rule-add':          self.addRule();                                  break;
          case 'rule-delete':       self.deleteRule(index);                          break;
          case 'rule-up':           self.moveRuleUp(index);                          break;
          case 'rule-down':         self.moveRuleDown(index);                        break;
          case 'rule-revert':       self.revertRules();                              break;
          case 'rule-save':         await self.saveRules();                          break;
          case 'rule-pattern':      self.autoRules[index].setPattern(el.value);      break;
          case 'rule-type':         self.autoRules[index].setType(el.value);         break;
          case 'rule-subject':      self.autoRules[index].setSubject(el.value);      break;
          case 'rule-proxy':        self.autoRules[index].setProxyName(el.value);    break;
          case 'rule-auto-default': self.autoDefault = el.value;                     break;
          case 'badge-conf-revert': self.revertBadgeConfs();                         break;
          case 'badge-conf-save':   await self.saveBadgeConfs();                     break;
          case 'badge-conf-text':   self.badgeConfs[index].setText(el.value);        break;
          case 'badge-conf-fg':     self.badgeConfs[index].setFg(el.value);          break;
          case 'badge-conf-bg':     self.badgeConfs[index].setBg(el.value);          break;
        }
        document.querySelector('button.rule-revert').disabled = !self.areRulesModified();
        document.querySelector('button.proxy-revert').disabled = !self.areProxiesModified();
        document.querySelector('button.badge-conf-revert').disabled = !self.areBadgeConfsModified();
      });
    });
  }
  revertProxies(skipRender) {
    this.proxies = proxyman.options.proxies.map((p) => p.clone());
    if (!skipRender) this.render();
  }
  revertRules(skipRender) {
    this.autoRules = proxyman.options.autoRules.map((r) => r.clone());
    this.autoDefault = proxyman.options.autoDefault || ProxyMode.DIRECT;
    if (!skipRender) this.render();
  }
  revertBadgeConfs(skipRender) {
    const badgeConfs = proxyman.options.badgeConfs;
    this.badgeConfs = Object.fromEntries(
      Object.keys(badgeConfs).map(
        (badgeType) => [badgeType, badgeConfs[badgeType].clone()]
      )
    );
    if (!skipRender) this.render();
  }
  areRulesModified() {
    return JSON.stringify(this.autoRules) !== JSON.stringify(proxyman.options.autoRules)
      || this.autoDefault !== proxyman.options.autoDefault;
  }
  areProxiesModified() {
    return JSON.stringify(this.proxies) !== JSON.stringify(proxyman.options.proxies);
  }
  areBadgeConfsModified() {
    return JSON.stringify(this.badgeConfs) !== JSON.stringify(proxyman.options.badgeConfs);
  }
  addProxy() {
    this.proxies.push(new ProxyConfig());
    this.render();
  }
  addRule() {
    this.autoRules.push(new Rule());
    this.render();
  }
  resetValidation() {
    document.querySelectorAll('.invalid').forEach((el, i) => {
      el.classList.remove('invalid');
    });
  }
  validateProxies() {
    let valid = true;
    for (const [index, proxy] of this.proxies.entries()) {
      if (!proxy.isValid()) {
        const tr = document.querySelector(`tr.proxies[data-index="${index}"]`);
        if (tr) tr.classList.add('invalid');
        valid = false;
      }
    }
    return valid;
  }
  validateRules() {
    let valid = true;
    for (const [index, rule] of this.autoRules.entries()) {
      if (!rule.isValid(proxyman)) {
        const tr = document.querySelector(`tr.autoRules[data-index="${index}"]`);
        if (tr) tr.classList.add('invalid');
        valid = false;
      }
    }
    if (!(this.autoDefault === ProxyMode.DIRECT
        || proxyman.getProxyByName(this.autoDefault)
    )) {
      const tr = document.querySelector(`tr.auto-default`);
      if (tr) tr.classList.add('invalid')
      valid = false;
    }
    return valid;
  }
  async saveProxies() {
    if (!this.validateProxies()) return;
    proxyman.options.proxies = this.proxies.map((p) => p.clone());
    await proxyman.saveOptions();
    await proxyman.configureProxy();
    this.render();
  }
  async saveRules() {
    if (!this.validateRules()) return;
    proxyman.options.autoRules = this.autoRules.map((r) => r.clone());
    proxyman.options.autoDefault = this.autoDefault;
    await proxyman.saveOptions();
    await proxyman.configureProxy();
    this.render();
  }
  async saveBadgeConfs() {
    proxyman.options.badgeConfs = Object.fromEntries(
      Object.keys(proxyman.options.badgeConfs).map(
        (badgeType) => [badgeType, this.badgeConfs[badgeType].clone()]
      )
    );
    await proxyman.saveOptions();
    this.render();
  }
  deleteProxy(index) {
    this.proxies.splice(index, 1);
    this.render();
  }
  deleteRule(index) {
    this.autoRules.splice(index, 1);
    this.render();
  }
  moveRuleUp(index) {
    if (index <= 0) return;
    const temp = this.autoRules.splice(index, 1);
    this.autoRules.splice(index - 1, 0, temp[0]);
    this.render();
  }
  moveRuleDown(index) {
    if (index >= this.autoRules.length - 1) return;
    const temp = this.autoRules.splice(index, 1);
    this.autoRules.splice(index + 1, 0, temp[0]);
    this.render();
  }
  renderProxies() {
    let html = '';
    html += '<table>';
    html += '<tr>';
    html += '<th>Name</th>';
    html += '<th>Badge</th>';
    html += '<th>Color</th>';
    html += '<th>Background</th>';
    html += '<th>Scheme</th>';
    html += '<th>Host</th>';
    html += '<td>Port</td>';
    html += '<td></td>';
    html += '</tr>';
    for (const [index, proxy] of this.proxies.entries()) {
      html += `<tr class="proxies" data-index=${index}>`;
      html += `<td><input class="proxy-name" type="text" value="${proxy.name}" data-index=${index}></td>`;
      html += `<td><input class="proxy-badge-text" type="text" value="${proxy.badgeConf.text}" data-index=${index}></td>`;
      html += `<td><input class="proxy-badge-fg" type="color" value="${proxy.badgeConf.fg}" data-index=${index}></td>`;
      html += `<td><input class="proxy-badge-bg" type="color" value="${proxy.badgeConf.bg}" data-index=${index}></td>`;
      html += `<td><select class="proxy-scheme" data-index=${index}>`;
      for (const scheme of Object.values(ProxyScheme)) {
        html += `<option ${proxy.server.scheme === scheme ? 'selected' : ''}>${scheme}</option>`;
      }
      html += '</select></td>';
      html += `<td><input class="proxy-host" type="text" value="${proxy.server.host}" data-index=${index}></td>`;
      html += `<td><input class="proxy-port" type="text" value="${proxy.server.port || ''}" data-index=${index}></td>`;
      html += `<td><button class="proxy-delete" data-index=${index}>Delete</button></td>`;
      html += '</tr>';
    }
    html += '</table>';
    html += '<button class="proxy-add">Add</button>';
    html += '<button class="proxy-revert" disabled>Revert</button>';
    html += '<button class="proxy-save">Save</button>';
    document.querySelector('#proxies').innerHTML = html;
  }
  renderRules() {
    let html = '';
    html += '<table>';
    html += '<tr>';
    html += '<th>Pattern</th>';
    html += '<th>Pattern Type</th>';
    html += '<th>Match against</th>';
    html += '<td>Proxy to use</td>';
    html += '<td></td>';
    html += '</tr>';
    for (const [index, rule] of this.autoRules.entries()) {
      html += `<tr class="autoRules" data-index=${index}>`;
      html += `<td><input class="rule-pattern" type="text" value="${rule.pattern}" data-index=${index}></td>`;
      html += `<td><select class="rule-type" data-index=${index}>`;
      for (const type of Object.values(RuleType)) {
        html += `<option ${rule.type === type ? 'selected' : ''}>${type}</option>`;
      }
      html += '</select></td>';
      html += `<td><select class="rule-subject" data-index=${index}>`;
      for (const subject of Object.values(RuleSubject)) {
        html += `<option ${rule.subject === subject ? 'selected' : ''}>${subject}</option>`;
      }
      html += '</select></td>';
      html += `<td><select class="rule-proxy" data-index=${index}>`;
      html += `<option ${rule.proxyName === 'direct' ? 'selected' : ''}>direct</option>`;
      for (const proxy of proxyman.options.proxies) {
        html += `<option ${rule.proxyName === proxy.name ? 'selected' : ''}>${proxy.name}</option>`;
      }
      html += '</select></td>';
      html += `<td><button class="rule-up" data-index=${index}>Up</button>`;
      html += `<button class="rule-down" data-index=${index}>Down</button>`;
      html += `<button class="rule-delete" data-index=${index}>Delete</button></td>`;
      html += '</tr>';
    }
    html += '<tr>';
    html += '<td colspan=3>Default</td>';
    html += '<td colspan=2><select class="rule-auto-default">';
    html += `<option ${this.autoDefault === 'direct' ? 'selected' : ''}>direct</option>`;
    for (const proxy of proxyman.options.proxies) {
      html += `<option ${this.autoDefault === proxy.name ? 'selected' : ''}>${proxy.name}</option>`;
    }
    html += '</select></td>';
    html += '</tr>';
    html += '</table>';

    html += '<button class="rule-add">Add</button>';
    html += '<button class="rule-revert" disabled>Revert</button>';
    html += '<button class="rule-save">Save</button>';
    document.querySelector('#rules').innerHTML = html;
  }
  renderBadgeConfs() {
    let html = '';
    html += '<table>';
    html += '<tr>';
    html += '<th>Type</th>';
    html += '<th>Default badge</th>';
    html += '<th>Default color</th>';
    html += '<td>Default background</td>';
    html += '<td></td>';
    html += '</tr>';
    for (const [badgeType, badgeConf] of Object.entries(this.badgeConfs)) {
      html += `<tr>`;
      html += `<td>${ProxyModeLabels[badgeType]}</td>`;
      html += `<td><input class="badge-conf-text" type="text" value="${badgeConf.text}" data-index="${badgeType}">`;
      html += `<td><input class="badge-conf-fg" type="color" value="${badgeConf.fg}" data-index="${badgeType}">`;
      html += `<td><input class="badge-conf-bg" type="color" value="${badgeConf.bg}" data-index="${badgeType}">`;
    }
    html += '</tr>';
    html += '</table>';

    html += '<button class="badge-conf-revert" disabled>Revert</button>';
    html += '<button class="badge-conf-save">Save</button>';
    document.querySelector('#badge-conf').innerHTML = html;
  }
  hookRegexTest() {
    const regex = document.querySelector('#test-regex');
    const subject = document.querySelector('#test-subject');
    const doTest = () => {
      subject.classList.remove('match', 'no-match');
      regex.classList.remove('invalid');
      try {
        const match = (new RegExp(regex.value)).test(subject.value);
        subject.classList.add(match ? 'match' : 'no-match');
      } catch (e) {
        regex.classList.add('invalid');
      }
    };
    regex.addEventListener('input', (e) => { doTest(); });
    subject.addEventListener('input', (e) => { doTest(); });
  }
}

const proxyman = new ProxyMan();
await proxyman.loadOptions();
await proxyman.loadProxySettings();
proxyman.listenForProxySettings(null);
proxyman.listenForOptions(null);

const page = new OptionsPage();
page.revertProxies(true);
page.revertRules(true);
page.revertBadgeConfs(true);
page.render();
page.hookRegexTest();
