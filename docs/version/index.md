# Documentation of releases

This page contains links to the documentation of all versions released so far.

'main' is current developer version.

<script type="text/javascript">
function link(chapDef){ return `<li><a href="./${chapDef.subdir}/${chapDef.filename}.html">${chapDef.title}</a></li>` }
function compVersions(a, b){
  let a = a.split('-');
  let b = b.split('-');
  if(a[0] != b[0]){ return b[0] - a[0] }
  return b[1] - a[1];
}
function sortVersionDESC(versionNames){
  let result = [...versionNames];
  result.sort(compVersions);
  return result;
}

document.body.subPages = function(json){
  let chapters = JSON.parse(json);
  let chapList = {};
  for (let c of chapters){ chapList[c.subdir] = c }

  let result = [];
  if(chapList.main) { 
    result.push(link(chapList.main));
    delete chapList.main;
  }
  for(let v of sortVersionDESC(Object.keys(chapList))){
    result.push(link(chapList[v]));
  }
  let list = document.createElement('ul');
  list.innerHTML = result.join('\n');
  document.body.apendChild(list);
}
</script>


<style type="text/css">
#sidemenu {
  width: 350px; height: 100%;
  position: fixed; top: 0px; right: 0px;
  border-left: 1px solid black;
  padding-left: 25px;
  line-height: 1.4em;
  box-sizing: border-box;
  overflow-y: auto;
  display: block;
}
#sidemenu ul {
  margin-bottom: 0px;
  padding-left: 25px;
}
body {
  width: calc(100% - 350px);
  box-sizing: border-box;
  padding-right: 30px;
}
</style>


<div id="sidemenu">
<h2>Subchapters</h2>
<ul>
<li><a href="./main/index.html">batocera-es-onArch main</a></li>
</ul>
</div>
