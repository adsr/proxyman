import {
  ProxyConfig,
  ProxyMan,
  ProxyMode,
  ProxyScheme,
  ProxyServer,
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
  }
  render() {
    const self = this;
    this.renderProxies();
    this.renderRules();
    document.querySelectorAll('button, input, select').forEach((el, i) => {
      el.addEventListener(el.tagName === 'BUTTON' ? 'click' : 'input', (e) => {
        self.resetValidation();
        const el = e.target;
        const index = parseInt(el.dataset.index || 0, 10);
        switch (el.className) {
          case 'proxy-add':    self.addProxy();           break;
          case 'rule-add':     self.addRule();            break;
          case 'proxy-revert': self.revertProxies();      break;
          case 'rule-revert':  self.revertRules();        break;
          case 'proxy-save':   self.saveProxies();        break;
          case 'rule-save':    self.saveRules();          break;
          case 'proxy-delete': self.deleteProxy(index);   break;
          case 'rule-delete':  self.deleteRule(index);    break;
          case 'rule-up':      self.moveRuleUp(index);    break;
          case 'rule-down':    self.moveRuleDown(index);  break;
          case 'name':    self.proxies[index].name = el.value;            break;
          case 'badge':   self.proxies[index].badgeText = el.value;       break;
          case 'host':    self.proxies[index].server.host = el.value;     break;
          case 'port':    self.proxies[index].server.setPort(el.value);   break;
          case 'scheme':  self.proxies[index].server.setScheme(el.value); break;
          case 'pattern': self.autoRules[index].pattern = el.value;       break;
          case 'type':    self.autoRules[index].setType(el.value);        break;
          case 'subject': self.autoRules[index].setSubject(el.value);     break;
          case 'proxy':   self.autoRules[index].proxyName = el.value;     break;
          case 'auto-default': self.autoDefault = el.value; break;
        }
        document.querySelector('button.rule-revert').disabled = !self.areRulesModified();
        document.querySelector('button.proxy-revert').disabled = !self.areProxiesModified();
      });
    });
  }
  revertProxies(skipRender) {
    this.proxies = proxyman.options.proxies.map((p) => p.clone());
    if (!skipRender) this.render();
  }
  revertRules(skipRender) {
    this.autoRules = proxyman.options.autoRules.map((r) => r.clone());
    this.autoDefault = proxyman.options.autoDefault || 'direct';
    if (!skipRender) this.render();
  }
  areRulesModified() {
    return JSON.stringify(this.autoRules) !== JSON.stringify(proxyman.options.autoRules)
      || this.autoDefault !== proxyman.options.autoDefault;
  }
  areProxiesModified() {
    return JSON.stringify(this.proxies) !== JSON.stringify(proxyman.options.proxies);
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
  saveProxies() {
    if (!this.validateProxies()) return;
    proxyman.options.proxies = this.proxies.map((p) => p.clone());
    proxyman.saveOptions();
    proxyman.configureProxy();
    this.render();
  }
  saveRules() {
    if (!this.validateRules()) return;
    proxyman.options.autoRules = this.autoRules.map((r) => r.clone());
    proxyman.options.autoDefault = this.autoDefault;
    proxyman.saveOptions();
    proxyman.configureProxy();
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
    html += '<td>Name</td>';
    html += '<td>Badge</td>';
    html += '<td>Scheme</td>';
    html += '<td>Host</td>';
    html += '<td>Port</td>';
    html += '<td></td>';
    html += '</tr>';
    for (const [index, proxy] of this.proxies.entries()) {
      html += `<tr class="proxies" data-index=${index}>`;
      html += `<td><input class="name" type="text" value="${proxy.name}" data-index=${index}></td>`;
      html += `<td><input class="badge" type="text" value="${proxy.badgeText}" data-index=${index}></td>`;
      html += `<td><select class="scheme" data-index=${index}>`;
      for (const scheme of Object.values(ProxyScheme)) {
        html += `<option ${proxy.server.scheme === scheme ? 'selected' : ''}>${scheme}</option>`;
      }
      html += '</select></td>';
      html += `<td><input class="host" type="text" value="${proxy.server.host}" data-index=${index}></td>`;
      html += `<td><input class="port" type="text" value="${proxy.server.port || ''}" data-index=${index}></td>`;
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
    html += '<td>Pattern</td>';
    html += '<td>Pattern Type</td>';
    html += '<td>Match against</td>';
    html += '<td>Proxy to use</td>';
    html += '<td></td>';
    html += '</tr>';
    for (const [index, rule] of this.autoRules.entries()) {
      html += `<tr class="autoRules" data-index=${index}>`;
      html += `<td><input class="pattern" type="text" value="${rule.pattern}" data-index=${index}></td>`;
      html += `<td><select class="type" data-index=${index}>`;
      for (const type of Object.values(RuleType)) {
        html += `<option ${rule.type === type ? 'selected' : ''}>${type}</option>`;
      }
      html += '</select></td>';
      html += `<td><select class="subject" data-index=${index}>`;
      for (const subject of Object.values(RuleSubject)) {
        html += `<option ${rule.subject === subject ? 'selected' : ''}>${subject}</option>`;
      }
      html += '</select></td>';
      html += `<td><select class="proxy" data-index=${index}>`;
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
    html += '<tr class="auto-default">';
    html += '<td colspan=3>Default</td>';
    html += '<td colspan=2><select class="auto-default">';
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
page.render();
page.hookRegexTest();