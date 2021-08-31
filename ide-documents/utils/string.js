exports.replaceAll = function(string, find, replace) {
  return string.replace(new RegExp(find, 'g'), replace);
};

exports.unescapePath = function(path) {
  console.log("unescapePath: " + path);
	return path.replace(/\\/g, '');
};

exports.getNameFromPath = function(path) {
	var splittedFullName = path.split("/");
	var name = splittedFullName[splittedFullName.length - 1];
	return (!name || name.lenght === 0) ? "root" : name;
};