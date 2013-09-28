var port = chrome.extension.connect(), collapsers, options, jsonObject;
var ctrl = false;

function displayError(error, loc, offset) {
	var link = document.createElement("link"), pre = document.body.firstChild.firstChild, text = pre.textContent.substring(offset), start = 0, ranges = [], idx = 0, end, range = document
			.createRange(), imgError = document.createElement("img"), content = document.createElement("div"), errorPosition = document.createElement("span"), container = document
			.createElement("div"), closeButton = document.createElement("div");
	link.rel = "stylesheet";
	link.type = "text/css";
	link.href = chrome.extension.getURL("content_error.css");
	document.head.appendChild(link);
	while (idx != -1) {
		idx = text.indexOf("\n", start);
		ranges.push(start);
		start = idx + 1;
	}
	start = ranges[loc.first_line - 1] + loc.first_column + offset;
	end = ranges[loc.last_line - 1] + loc.last_column + offset;
	range.setStart(pre, start);
	if (start == end - 1)
		range.setEnd(pre, start);
	else
		range.setEnd(pre, end);
	errorPosition.className = "error-position";
	errorPosition.id = "error-position";
	range.surroundContents(errorPosition);
	imgError.src = chrome.extension.getURL("error.gif");
	errorPosition.insertBefore(imgError, errorPosition.firstChild);
	content.className = "content";
	closeButton.className = "close-error";
	closeButton.onclick = function() {
		content.parentElement.removeChild(content);
	};
	content.textContent = error;
	content.appendChild(closeButton);
	container.className = "container";
	container.appendChild(content);
	errorPosition.parentNode.insertBefore(container, errorPosition.nextSibling);
	location.hash = "error-position";
	history.replaceState({}, "", "#");
}

function displayUI(theme, html) {
	var statusElement, toolboxElement, expandElement, reduceElement, viewSourceElement, clipboardElement, optionsElement, content = "";
	content += '<link rel="stylesheet" type="text/css" href="' + chrome.extension.getURL("jsonview-core.css") + '">';
	content += "<style>" + theme + "</style>";
	content += html;
	document.body.innerHTML = content;
	collapsers = document.querySelectorAll("#json .collapsible .collapsible");
	statusElement = document.createElement("div");
	statusElement.className = "status";
	copyPathElement = document.createElement("div");
	copyPathElement.className = "copy-path";
	statusElement.appendChild(copyPathElement);
	document.body.appendChild(statusElement);
	toolboxElement = document.createElement("div");
	toolboxElement.className = "toolbox";
	expandElement = document.createElement("span");
	expandElement.title = "expand all";
	expandElement.innerText = "+";
	reduceElement = document.createElement("span");
	reduceElement.title = "reduce all";
	reduceElement.innerText = "-";
	viewSourceElement = document.createElement("a");
	viewSourceElement.innerText = "View source";
	viewSourceElement.target = "_blank";
	viewSourceElement.href = "view-source:" + location.href;
	clipboardElement = document.createElement("img");
	clipboardElement.title = "copy selected";
	clipboardElement.src = chrome.extension.getURL("clipboard16.png");
	optionsElement = document.createElement("img");
	optionsElement.title = "options";
	optionsElement.src = chrome.extension.getURL("options.png");
	toolboxElement.appendChild(expandElement);
	toolboxElement.appendChild(reduceElement);
	toolboxElement.appendChild(viewSourceElement);
	toolboxElement.appendChild(clipboardElement);
	toolboxElement.appendChild(optionsElement);
	document.body.appendChild(toolboxElement);
	document.body.addEventListener('click', ontoggle, false);
	document.body.addEventListener('mouseover', onmouseMove, false);
	document.body.addEventListener('click', onmouseClick, false);
	document.body.addEventListener('contextmenu', onContextMenu, false);
	document.body.onkeydown = function(e) { if (e.keyCode === 17) ctrl = true };
	document.body.onkeyup = function(e) { if (e.keyCode === 17) ctrl = false };
	expandElement.addEventListener('click', onexpand, false);
	reduceElement.addEventListener('click', onreduce, false);
	clipboardElement.addEventListener('click', function() {
		port.postMessage({
			copySelected : true,
			selected: getSelected()
		});
	}, false);
	optionsElement.addEventListener("click", function() {
		window.open(chrome.extension.getURL("options.html"));
	}, false);
	copyPathElement.addEventListener("click", function() {
		port.postMessage({
			copyPropertyPath : true,
			path : statusElement.innerText
		});
	}, false);
}

function extractData(rawText) {
	var tokens, text = rawText.trim();

	function test(text) {
		return ((text.charAt(0) == "[" && text.charAt(text.length - 1) == "]") || (text.charAt(0) == "{" && text.charAt(text.length - 1) == "}"));
	}

	if (test(text))
		return {
			text : rawText,
			offset : 0
		};
	tokens = text.match(/^([^\s\(]*)\s*\(([\s\S]*)\)\s*;?$/);
	if (tokens && tokens[1] && tokens[2]) {
		if (test(tokens[2].trim()))
			return {
				fnName : tokens[1],
				text : tokens[2],
				offset : rawText.indexOf(tokens[2])
			};
	}
}

function processData(data) {
	var xhr, jsonText;
	
	function formatToHTML(fnName, offset) {
		if (!jsonText)
			return;	
		port.postMessage({
			jsonToHTML : true,
			json : jsonText,
			fnName : fnName,
			offset : offset
		});
		try {
			jsonObject = JSON.parse(jsonText);
		} catch (e) {
		}
	}

	if (window == top || options.injectInFrame)
		if (options.safeMethod) {
			xhr = new XMLHttpRequest();
			xhr.onreadystatechange = function() {
				if (this.readyState == 4) {
					data = extractData(this.responseText);
					if (data) {
						jsonText = data.text;
						formatToHTML(data.fnName, data.offset);
					}
				}
			};
			xhr.open("GET", document.location.href, true);
			xhr.send(null);
		} else if (data) {
			jsonText = data.text;
			formatToHTML(data.fnName, data.offset);
		}
}

function ontoggle(event) {
	var collapsed, target = event.target;
	if (event.target.className == 'collapser') {
		collapsed = target.parentNode.getElementsByClassName('collapsible')[0];
		if (collapsed.parentNode.classList.contains("collapsed"))
			collapsed.parentNode.classList.remove("collapsed");
		else
			collapsed.parentNode.classList.add("collapsed");
	}
}

function onexpand() {
	Array.prototype.forEach.call(collapsers, function(collapsed) {
		if (collapsed.parentNode.classList.contains("collapsed"))
			collapsed.parentNode.classList.remove("collapsed");
	});
}

function onreduce() {
	Array.prototype.forEach.call(collapsers, function(collapsed) {
		if (!collapsed.parentNode.classList.contains("collapsed"))
			collapsed.parentNode.classList.add("collapsed");
	});
}

function getSelected() {
	var selecteds = document.getElementsByClassName('selected');
	var txt = "";
	Array.prototype.forEach.call(selecteds, function(selected) {
		// console.log(selected);
		var path = getPath(getParentLI(selected));
		var value = getValue(path);
		txt = txt + value + "\n";
	});
	// console.log(txt);
	return txt;
}

function getPath(element) {
	var str = "";
	do {
		if (element.parentNode.classList.contains("array")) {
			var index = [].indexOf.call(element.parentNode.children, element);
			str = "[" + index + "]" + str;
		}
		if (element.parentNode.classList.contains("obj")) {
			str = "." + element.firstChild.firstChild.innerText + str;
		}
		element = element.parentNode.parentNode.parentNode;
	} while (element.tagName == "LI");
	if (str.charAt(0) == '.')
		str = str.substring(1);
	return str;
}

function getValue(path) {
	if (Array.isArray(jsonObject))
		return eval("(jsonObject" + path + ")");
	else
		return eval("(jsonObject." + path + ")");
}

function getParentLI(element) {
	if (element.tagName != "LI")
		while (element && element.tagName != "LI")
			element = element.parentNode;
	if (element && element.tagName == "LI")
		return element;
}

var onmouseMove = (function() {
	var hoveredLI;

	function onmouseOut() {
		var statusElement = document.querySelector(".status");
		if (hoveredLI) {
			hoveredLI.firstChild.classList.remove("hovered");
			hoveredLI = null;
			statusElement.innerText = "";
		}
	}

	return function(event) {
		var str = "", statusElement = document.querySelector(".status");
		element = getParentLI(event.target);
		if (element) {
			if (hoveredLI)
				hoveredLI.firstChild.classList.remove("hovered");
			hoveredLI = element;
			element.firstChild.classList.add("hovered");
			statusElement.innerText = getPath(element);
			return;
		}
		onmouseOut();
	};
})();

var selectedLI;

function onmouseClick() {
	if (!event.target) {
		// console.log("undefined");
		return;
	}
	selectedLI = getParentLI(event.target);

	// <debug>
	element = selectedLI;
	// console.log(element);
	// console.log(element.parentNode);
	// console.log(element.parentNode.classList);
	// </debug>

	if (selectedLI) {
		var stringss, nullss, target = event.target;
		stringss = target.parentNode.getElementsByClassName('type-string');
		nullss = target.parentNode.getElementsByClassName('type-null');
		// console.log("Length "+stringss.length+" Ctrl "+ctrl);
		// console.log(stringss);

		// Choose to remove all if at least one selected child entry
		var remove = false;
		Array.prototype.forEach.call(stringss, function(selected) {
			if (selected.parentNode.classList.contains("selected")) {
				remove = true;
				return;
			}
		});
		Array.prototype.forEach.call(nullss, function(selected) {
			if (selected.parentNode.classList.contains("selected")) {
				remove = true;
				return;
			}
		});
		// console.log("remove="+remove);

		// Actually remove or add
		Array.prototype.forEach.call(stringss, function(selected) {
			if (remove)
				selected.parentNode.classList.remove("selected");
			else
				selected.parentNode.classList.add("selected");
		});
		Array.prototype.forEach.call(nullss, function(selected) {
			if (remove)
				selected.parentNode.classList.remove("selected");
			else
				selected.parentNode.classList.add("selected");
		});
	}
}

function onContextMenu() {
	var currentLI, statusElement, selection = "", i, value;
	currentLI = getParentLI(event.target);
	statusElement = document.querySelector(".status");
	if (currentLI) {
		value = getValue(statusElement.innerText);
		port.postMessage({
			copyPropertyPath : true,
			path : statusElement.innerText,
			value : typeof value == "object" ? JSON.stringify(value) : value,
			selected : getSelected()
		});
	}
}

function init(data) {
	port.onMessage.addListener(function(msg) {
		if (msg.oninit) {
			options = msg.options;
			processData(data);
		}
		if (msg.onjsonToHTML)
			if (msg.html) {
				displayUI(msg.theme, msg.html);
			} else if (msg.json)
				port.postMessage({
					getError : true,
					json : json,
					fnName : fnName
				});
		if (msg.ongetError) {
			displayError(msg.error, msg.loc, msg.offset);
		}
	});
	port.postMessage({
		init : true
	});
}

function load() {
	var child, data;
	if (document.body && (document.body.childNodes[0] && document.body.childNodes[0].tagName == "PRE" || document.body.children.length == 0)) {
		child = document.body.children.length ? document.body.childNodes[0] : document.body;
		data = extractData(child.innerText);
		if (data)
			init(data);
	}
}

load();
