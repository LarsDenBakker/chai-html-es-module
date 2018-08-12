import parse5 from 'parse5';
import deepDiff from 'deep-diff';

var walk = function walk (tree, path) {
  let leaf = tree;

  for (let step of path) {
    if (Number.isInteger(step) || step === 'childNodes' || step === 'attrs') {
      leaf = leaf[step];
    } else {
      break
    }
  }

  return leaf
};

var format = function format (html) {
  return html
    // Remove whitespace between elements (no whitespace only nodes)
    .replace(/>\s+</g, '><')
    // Remove leading and trailing whitespace
    .trim()
};

function thing (ast) {
  if (ast.nodeName === '#text') {
    return `text "${ast.value}"`
  } else if (ast.tagName) {
    return `tag <${ast.tagName}>`
  } else if (ast.name && ast.value) {
    return `attribute [${ast.name}="${ast.value}"]`
  } else if (ast.name) {
    return `attribute [${ast.name}]`
  }
}

var strategy = function strategy (diff, lhs, rhs) {
  switch (diff.kind) {
    case 'N':
      // take new property from RHS
      return `${thing(rhs)} has been added`

    case 'E':
      // take edited property from both sides
      return `${thing(lhs)} was changed to ${thing(rhs)}`

    case 'D':
      // take deleted property from LHS
      return `${thing(lhs)} has been removed`

    case 'A':
      // send the array difference back through if we receive an array
      return strategy(diff.item, lhs[diff.index], rhs[diff.index])
  }
};

function attributes (attrs) {
  return attrs
    .map((attr) => {
      // Sort class names alphanumerically
      if (attr.name === 'class') {
        attr.value = attr.value.trim().split(/\s+/).sort().join(' ');
      }

      return attr
    })
    .sort((a, b) => {
      // Sort attributes alphanumerically
      a = a.name.toLowerCase();
      b = b.name.toLowerCase();

      if (a < b) {
        return -1
      }

      if (a > b) {
        return 1
      }
    })
}

function whitespace (childNodes) {
  const last = childNodes.length - 1;

  childNodes.forEach((node, i) => {
    // a line break immediately following a start tag must be ignored...
    // ... as must a line break immediately before an end tag
    // <https://www.w3.org/TR/html4/appendix/notes.html#notes-line-breaks>
    if (node.nodeName === '#text' && i === 0) {
      node.value = node.value.replace(/^\s+/, '');
    }

    if (node.nodeName === '#text' && i === last) {
      node.value = node.value.replace(/\s+$/, '');
    }
  });
}

var normalize = function normalize (tree) {
  if (Array.isArray(tree)) {
    tree.forEach(normalize);
  } else {
    if (tree.attrs) {
      tree.attrs = attributes(tree.attrs);
    }

    if (tree.childNodes) {
      whitespace(tree.childNodes);
      normalize(tree.childNodes);
    }
  }
};

function chaiHtmlPlugin (chai, utils) {
  chai.Assertion.addProperty('html', function () {
    new chai.Assertion(this._obj).to.be.a('string');
    utils.flag(this, 'html', true);
  });

  function compare (_super) {
    return function (value) {
      if (utils.flag(this, 'html')) {
        const lhsFormatted = format(this._obj);
        const rhsFormatted = format(value);

        const lhsTree = parse5.parseFragment(lhsFormatted);
        const rhsTree = parse5.parseFragment(rhsFormatted);

        normalize(lhsTree);
        normalize(rhsTree);

        // deep-diff 0.3.6 trips on circular references
        const ignore = (path, key) => key === 'parentNode';

        const diff = deepDiff(lhsTree, rhsTree, ignore);

        if (diff) {
          const change = diff.shift();

          // extract changed node from tree
          const lhsNode = walk(lhsTree, change.path);
          const rhsNode = walk(rhsTree, change.path);

          utils.flag(this, 'message', strategy(change, lhsNode, rhsNode));
        }

        if (!diff && utils.flag(this, 'negate')) {
          throw new chai.AssertionError('expected HTML not to be equivalent')
        }

        if (diff && !utils.flag(this, 'negate')) {
          throw new chai.AssertionError(utils.flag(this, 'message'))
        }
      } else {
        _super.apply(this, arguments);
      }
    }
  }

  chai.Assertion.overwriteMethod('equals', compare);
  chai.Assertion.overwriteMethod('equal', compare);
  chai.Assertion.overwriteMethod('eq', compare);
}

var chaiHtml = chaiHtmlPlugin;

export default chaiHtml;
