const src = '/assets/peeps'
const assets = {};
let rootSymbol = 'a-person';

function download(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

const Asset = function(url){
  this.url = url;
  this.ready = false;
  this.data = false;
  this.done = () =>
    fetch(url)
    .then(res => res.json())
    .then(data => { this.ready = true; this.data = data; });
}

function classList(vnode){
  if (!vnode.attrs) return [];
  if(!vnode.attrs['class']) return [];
  return (vnode.attrs['class'] || '').split(" ");
}

function isSymbol(sym){
  return classList(sym).includes('symbol');
}

function Symbol(group, name) {
  if (!group || !name || !assets[group] || !assets[group][name]) {
    return false;  // loading?
  }
  let asset = assets[group][name];
  if(!asset.ready){
    asset.done().then(() => {
      m.redraw();
    });
    return false;
  }
  return asset.data;
}

function symGroup(sym){
   return classList(sym).filter(x => x != 'symbol').sort().join("-");
}

function symContent(sym, selections, pathStyles){
  const group = symGroup(sym);
  const name = selections[group];
  const ref = Symbol(group, name);
  if (!ref) return [];
  let vdom = _.cloneDeep(ref);
  setPathStyles(vdom, pathStyles);
  return vdom.children || [];
}

function symView(sym, selections, pathStyles){
  return {
    ..._.cloneDeep(sym),
    children: isSymbol(sym)
      ? symContent(sym, selections, pathStyles)
      : (sym.children || []).map(child => symView(child, selections, pathStyles))
  }
}

function findSelections(vdom, selections){
  let result = [];
  if (!vdom){ return result; }
  if (isSymbol(vdom)){
    let grp = symGroup(vdom);
    result.push({symbol: grp, id: selections[grp]});
  }
  for (let child of (vdom.children || [])){
    result = [...result, ...findSelections(child, selections)]
  }
  return result;
}

function findPathStyles(vdom) {
  let result = {};
  if (!vdom) { return result; }
  if (vdom.tag === 'path') {
    let a = vdom.attrs || {};
    if (a.class){
      result[a.class] = {fill: a.fill || 'none', stroke: a.stroke || 'none'};
    }
  }
  for (let child of (vdom.children || [])){
    result = {...result, ...findPathStyles(child)};
  }
  return result;
}

function setPathStyles(vdom, pathStyles) {
  let result = {};
  if (!vdom) { return result; }
  if (vdom.tag === 'path') {
    let a = vdom.attrs || {};
    let s = pathStyles[a.class];
    if (s) {
      a.fill = s.fill;
      a.stroke = s.stroke;
    }
  }
  for (let child of (vdom.children || [])){
    setPathStyles(child, pathStyles);
  }
  return result;
}

const Peep = function(s, p) {
  let selections = {'a-person': 'bust'};
  let pathStyles = {};

  function randSelection(s) {
    const item_ids = Object.keys(assets[s]);
    let random_index;
    let orig_selection = selections[s];
    do {
      let random_index = Math.floor(Math.random() * item_ids.length);
      selections[s] = item_ids[random_index];
    } while(selections[s] === orig_selection);
  }

  function randAll() {
      Object.keys(assets).filter(s => s !== rootSymbol).map(randSelection);
  }

  function randColor() {
    return "#" + Math.floor( Math.random() * 0xFFFFFF ).toString(16);
  }

  function randStyle(cls) {
    if(!pathStyles[cls]) pathStyles[cls] = {};
    let style = pathStyles[cls];
    style.fill = randColor();
    return style;
  }

  function view() {
    let sym = Symbol(rootSymbol, selections[rootSymbol]);
    if (!sym) {
      return m('svg');
    }
    return symView(sym, selections, pathStyles);
  }

  function getSelections(){
    return findSelections(view(), selections);
  }

  function getPathStyles(){
    return findPathStyles(view());
  }

  function copy(){
    return Peep(getSelections());
  }

  if(!s){
    randAll()
  } else {
    for (let x of s){
      selections[x.symbol] = x.id;
    }
  }
  if(p){
    pathStyles = {...pathStyles, ...p};
  }
  let props = {};
  return {view, getSelections, getPathStyles, randSelection, randStyle, randAll, copy, props};
}

const App = function() {

  let people = [];
  const card = '.w5.card.dib.ma3.pa3.br3.shadow-1.bg-near-white';
  let nextPerson = Peep();

  const deletePerson = (p) => { people = people.filter(x => x != p) };
  const addPerson = (p) => { people.push(p) };
  const newPerson = () => { nextPerson = Peep() };

  function PersonCard(p) {
    function view(){
      let { configOpen, pathStyleOpen } = p.props;
      return m(card,
        m('.relative',
          m('.absolute.top-0.left-0.gray',
            m('div', { onclick: () => p.props.configOpen = !configOpen }, m('i.pointer.link.pa1.f3.fas.fa-cog')),
            m('.pa2'),
            configOpen && [
              m('div', { onclick: () => addPerson(p.copy()) }, m('i.pointer.link.pa1.f3.far.fa-clone')),
            ]
          ),
          m('.absolute.top-0.right-0.gray',
            m('div', { onclick: () => deletePerson(p) }, m('i.pointer.link.pa1.f3.fas.fa-trash')),
          ),
        ),
        m('.pv3', m(p)),
        m('.relative',
          m('.absolute.bottom-0.left-0.gray',
            m('div', { onclick: () => p.randAll() }, m('i.pointer.link.pa1.f3.fas.fa-dice-two')),
          ),
          m('.absolute.bottom-0.right-0.gray',
            m('div', { onclick: () => p.props.pathStyleOpen = !pathStyleOpen }, m('i.pointer.link.pa1.f3.fas.fa-fill-drip')),
          ),
        ),
        pathStyleOpen && m('.ph1.pt3',
          Object.entries(p.getPathStyles()).map(([cls, style]) =>
            m('.dib.ma2.w2.h2.ba.bw1.br-100.b--gray', {
              style: `background-color: ${style.fill};`,
              onclick: () => {p.randStyle(cls); m.redraw()}
            })
          )
        )
      );
    };
    return {view};
  }

  function getSVG(){
    let elems = Array.from(document.querySelectorAll('svg'));
    elems.length = elems.length - 1
    let zip = JSZip();
    let index = '<html><body>';
    for (let i in elems){
      let filename = `${i}.svg`;
      zip.file(filename, elems[i].outerHTML);
      index += `<img src="${filename}"></img>`;
    }
    index += '</body></html>'
    zip.file('index.html', index);
    zip.generateAsync({type: 'blob'})
       .then(content => saveAs(content, "peeps.zip"));
  }

  function view(v) {
    return m('.w-100.dt.center',
      m('.fixed.z-9999.top-0.right-0.ma2.clickthrough', {onclick: () => getSVG() },  m('i.pointer.link.pointer-auto.pa2.bg-dark-blue.br3.fas.fa-download.f4.near-white')),
      people.map(p => m(PersonCard(p))),
      m(`${card}.o-50`,
        m('div',
          { onclick: () => { addPerson(nextPerson); newPerson(); } },
          m('.relative.pv3', m(nextPerson)),
        )
      ),
    );
  }
  return {view};
}

fetch(`${src}/directory.json`)
  .then(res => res.json())
  .then(directory => {
    let app = document.getElementById('app');
    for (let item of directory) {
      if(!assets[item.symbol]){ assets[item.symbol] = {}; }
      assets[item.symbol][item.id] = new Asset(item.url);
    }
    m.mount(app, App);
  });
