<!--
SPDX-FileCopyrightText: 2025 Karsten Teichmann

SPDX-License-Identifier: MIT
-->

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

<!-- generated-links -->