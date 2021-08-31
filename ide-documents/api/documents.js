let rs = require("http/v4/rs");
let user = require("security/v4/user");
let registry = require("platform/v4/registry");

let zipLib = require("ide-documents/api/lib/zip");
let folderLib = require("ide-documents/api/lib/folder");

let {replaceAll, unescapePath, getNameFromPath} = require("ide-documents/utils/string");

rs.service()
    .resource("")
        .get(function(ctx, request, response) {
            let path = ctx.queryParameters.path || "/";
            path = unescapePath(path);
            let folder = folderLib.getFolderOrRoot(path);
            let result = folderLib.readFolder(folder);
            filterByAccessDefinitions(result);
            response.println(JSON.stringify(result));
        })
	.resource("zip")
		.get(function(ctx, request, response) {
			let path = ctx.queryParameters.path || "/";
            path = unescapePath(path);
			let name = getNameFromPath(path);
			let outputStream = response.getOutputStream();
			response.setContentType("application/zip");
			response.addHeader("Content-Disposition", "attachment;filename=\"" + name +".zip\"");
			zipLib.makeZip(path, outputStream);
		})
.execute();

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