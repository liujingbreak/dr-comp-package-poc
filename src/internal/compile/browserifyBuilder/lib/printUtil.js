var _ = require('lodash');

module.exports = PrintNode;

function PrintNode(obj) {
	if (!(this instanceof PrintNode)) {
		return new PrintNode(obj);
	}
	_.assign(this, obj);
	this.level = 0;
	if (this.parent) {
		if (!this.parent.children) {
			this.parent.children = [];
		}
		this.parent.children.push(this);
		this.level = this.parent.level + 1;
		this.childIndex = this.parent.children.length;
	}
}
PrintNode.prototype.hasChild = function() {
	return this.children && this.children.length > 0;
};

PrintNode.prototype.isLast = function() {
	return this.childIndex ? this.childIndex === this.parent.children.length : true;
};

PrintNode.prototype.prefix =
/**
 * @param  {number} level
 * @param  {[type]} node  {parent, isLast(), hasChild()}
 */
function printNodePrefix() {
	var node = this;
	var level = this.level;
	if (level === 0) {
		return '';
	}
	var s = [];
	s.push(node.isLast() ? '└─' : '├─');
	s.push(node.hasChild() ? '┬ ' : '─ ');
	for (var i = 1; i < level; i++) {
		node = node.parent;
		s.unshift(node.isLast() ? '  ' : '| ' );
	}
	return s.join('');
};
