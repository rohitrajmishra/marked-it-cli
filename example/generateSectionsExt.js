/**
 * marked-it-cli
 *
 * Copyright (c) 2014, 2018 IBM Corporation
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software
 * and associated documentation files (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

var REGEX_HEADER = /^h([123456])$/;

var html = {};
var logger;

function processHeaders(level, dom, data) {
	var name = "h" + level;
	var headers = data.domUtils.findAll(
		function(current) {
			return current.name === name;
		},
		dom
	);
	for (var i = 0; i < headers.length; i++) {
		var current = headers[i];
		var id = data.domUtils.getAttributeValue(current, "id");
		if (!id) {
			logger.warning("Header has no id, so not generating an accompanying <section>: " + current.children[0].data);
			continue;
		}
		var index = -1;
		var siblings = data.domUtils.getSiblings(current);
		for (var j = 0; j < siblings.length; j++) {
			if (siblings[j] === current) {
				index = j;
				break;
			}
		}
		var section = data.htmlToDom("<section id='section-" + id + "'></section>")[0];
		data.domUtils.replaceElement(current, section);
		data.domUtils.appendChild(section, current);
		index++; /* now points at first sibling after the header-turned-section */

		/* 
		 * The #removeElement invocation in the loop removes siblings in-place,
		 * so should NOT iterate over them incrementally, just stay at `index`.
		 */
		while (index < siblings.length) {
			var sibling = siblings[index];
			var result = REGEX_HEADER.exec(sibling.name);
			if (result) {
				var siblingLevel = parseInt(result[1]);
				if (siblingLevel <= level) {
					break;
				}
			}
			data.domUtils.removeElement(sibling);
			data.domUtils.appendChild(section, sibling);
		}
	}
}

html.onComplete = function(html, data) {
	var dom = data.htmlToDom("<root>" + html + "</root>");
	for (var i = 6; i >= 1; i--) {
		processHeaders(i, dom, data);
	}
	return data.domToInnerHtml(dom[0]);
};

var init = function(data) {
	logger = data.logger;
};

module.exports.html = html;
module.exports.id = "createSections";
module.exports.init = init;
