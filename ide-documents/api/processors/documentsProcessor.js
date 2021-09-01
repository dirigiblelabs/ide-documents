let objectUtils = require("ide-documents/utils/cmis/object");
let folderUtils = require("ide-documents/utils/cmis/folder");
let documentUtils = require("ide-documents/utils/cmis/document");

exports.list = function(path) {
    let folder = folderUtils.getFolderOrRoot(path);
    let result = folderUtils.readFolder(folder);
    filterByAccessDefinitions(result);
    return result;
};

exports.create = function(path, documents, overwrite) {
	let result = [];
	for (let i = 0 ; i < documents.size(); i ++) {
		let folder = folderUtils.getFolder(path);
		if (overwrite){
			result.push(documentUtils.uploadDocumentOverwrite(folder, documents.get(i)));
		} else {
			result.push(documentUtils.uploadDocument(folder, documents.get(i)));		
		}
	}
	return result;
};

exports.rename = function(path, name) {
	let object = objectUtils.getObject(path);
	objectUtils.renameObject(object, name);
};

exports.delete = function(objects, forceDelete) {
	for (let i in objects) {
		let object = objectUtils.getObject(objects[i]);
		let isFolder = object.getType().getId() === 'cmis:folder';
		if (isFolder && forceDelete) {
			folderUtils.deleteTree(object);
		} else {
			objectUtils.deleteObject(object);
		}
	}
};

function filterByAccessDefinitions(folder) {
	let accessDefinitions = JSON.parse(registry.getText("ide-documents/security/roles.access"));
	folder.children = folder.children.filter(e => {
		let path = replaceAll((folder.path + "/" + e.name), "//", "/");
		if (path.startsWith("/__internal")) {
			return false;
		}
		if (!path.startsWith("/")) {
			path = "/" + path;
		}
		if (path.endsWith("/")) {
			path = path.substr(0, path.length - 1);
		}
		return hasAccessPermissions(accessDefinitions.constraints, path);
	});
}

function hasAccessPermissions(constraints, path) {
	for (let i = 0; i < constraints.length; i ++) {
		let method = constraints[i].method;
		let constraintPath = constraints[i].path;
		constraintPath = replaceAll(constraintPath, "//", "/");
		if (!constraintPath.startsWith("/")) {
			constraintPath = "/" + constraintPath;
		}
		if (constraintPath.endsWith("/")) {
			constraintPath = constraintPath.substr(0, constraintPath.length - 1);
		}
		if (constraintPath.length === 0 || (path.length >= constraintPath.length && constraintPath.startsWith(path))) {
			if (method !== null && method !== undefined && (method.toUpperCase() === "READ" || method === "*")) {				
				let roles = constraints[i].roles;
				for (let j = 0; j < roles.length; j ++) {
					if (!user.isInRole(roles[j])) {
						return false;
					}
				}
			}
		}
	}
	return true;
}