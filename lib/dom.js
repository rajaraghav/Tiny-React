const TinyReact = (function () {
  function createElement(type, attributes = {}, ...children) {
    let childElements = [].concat(...children).reduce((acc, child) => {
      if (child != null && child !== true && child !== false) {
        if (child instanceof Object) {
          acc.push(child);
        } else {
          acc.push(
            createElement("text", {
              textContent: child,
            })
          );
        }
      }
      return acc;
    }, []);
    return {
      type,
      children: childElements,
      props: Object.assign({ children: childElements }, attributes),
    };
  }

  const render = function (vdom, container, oldDom = container.firstChild) {
    diff(vdom, container, oldDom);
  };
  function createDomElement(vdom) {
    let newDomElement = null;
    if (vdom.type === "text") {
      newDomElement = document.createTextNode(vdom.props.textContent);
    } else {
      newDomElement = document.createElement(vdom.type);
      updateDomElement(newDomElement, vdom);
    }
    newDomElement._virtualElement = vdom;
    vdom.children.forEach((child) => {
      newDomElement.appendChild(createDomElement(child));
    });
    if (vdom.props && vdom.props.refs) {
      vdom.props.refs(newDomElement);
    }
    return newDomElement;
  }
  const diff = function (vdom, container, oldDom) {
    let oldvdom = oldDom && oldDom._virtualElement;
    let oldComponent = oldvdom && oldvdom.component;

    if (!oldDom) {
      mountElement(vdom, container, oldDom);
    } else if (typeof vdom.type === "function") {
      diffComponent(vdom, oldComponent, container, oldDom);
    } else if (oldvdom.type !== vdom.type && typeof vdom.type === "function") {
      let newDomElement = createDomElement(vdom);
      oldDom.parentNode.replaceChild(newDomElement, oldDom);
    } else if (oldvdom && oldvdom.type === vdom.type) {
      if (oldvdom.type === "text") {
        updateTextNode(oldDom, vdom, oldvdom);
      } else {
        updateDomElement(oldDom, vdom, oldvdom);
      }

      oldDom._virtualElement = vdom;

      vdom.children.forEach((child, i) => {
        diff(child, oldDom, oldDom.childNodes[i]);
      });

      let oldNodes = oldDom.childNodes;
      if (oldNodes.length > vdom.children.length) {
        for (let i = oldNodes.length - 1; i >= vdom.children.length; i -= 1) {
          let nodeToBeRemoved = oldNodes[i];
          unmountNode(nodeToBeRemoved, oldDom);
        }
      }
    }
  };

  function diffComponent(
    newVirtualElement,
    oldComponent,
    container,
    domElement
  ) {
    if (isSameComponent(oldComponent, newVirtualElement)) {
      updateComponent(newVirtualElement, oldComponent, container, domElement);
    } else {
      mountElement(newVirtualElement, container, domElement);
    }
  }
  function updateComponent(
    newVirtualElement,
    oldComponent,
    container,
    domElement
  ) {
    oldComponent.componentWillReceiveProps(newVirtualElement.props);
    if (
      oldComponent.shouldComponentUpdate(
        newVirtualElement.props,
        newVirtualElement.state
      )
    ) {
      const prevProps = oldComponent.props;

      oldComponent.componentWillUpdate(
        newVirtualElement.props,
        oldComponent.state
      );

      oldComponent.updateProps(newVirtualElement.props);

      const nextElement = oldComponent.render();
      nextElement.component = oldComponent;

      diff(nextElement, container, domElement, oldComponent);

      oldComponent.componentDidUpdate(prevProps);
    }
  }
  function isSameComponent(oldComponent, newVirtualElement) {
    return oldComponent && oldComponent.constructor === newVirtualElement.type;
  }
  const mountElement = function (vdom, container, oldDom) {
    if (isFunction(vdom)) {
      return mountComponent(vdom, container, oldDom);
    } else {
      return mountSimpleNode(vdom, container, oldDom);
    }
  };

  function isFunction(obj) {
    return obj && "function" === typeof obj.type;
  }

  function isFunctionalComponent(vnode) {
    let nodeType = vnode && vnode.type;
    return (
      nodeType &&
      isFunction(vnode) &&
      !(nodeType.prototype && nodeType.prototype.render)
    );
  }

  function buildFunctionalComponent(vnode, context) {
    return vnode.type(vnode.props || {});
  }
  function buildStatefulComponent(virtualElement) {
    const component = new virtualElement.type(virtualElement.props);
    const nextElement = component.render();
    nextElement.component = component;
    return nextElement;
  }

  function mountComponent(vdom, container, oldDomElement) {
    let nextvDom = null,
      component = null,
      newDomElement = null;
    if (isFunctionalComponent(vdom)) {
      nextvDom = buildFunctionalComponent(vdom);
    } else {
      nextvDom = buildStatefulComponent(vdom);
      component = nextvDom.component;
    }
    if (isFunction(nextvDom)) {
      return mountComponent(nextvDom, container, oldDomElement);
    } else {
      newDomElement = mountElement(nextvDom, container, oldDomElement);
    }

    if (component) {
      component.componentDidMount();
      if (component.props.ref) {
        component.props.ref(component);
      }
    }

    return newDomElement;
  }

  function unmountNode(domElement, parentComponent) {
    const virtualElement = domElement._virtualElement;
    if (!virtualElement) {
      domElement.remove();
      return;
    }
    let oldComponent = domElement._virtualElement.component;
    if (oldComponent) {
      oldComponent.componentWillUnmount();
    }
    while (domElement.childNodes.length > 0) {
      unmountNode(domElement.firstChild);
    }
    if (virtualElement.props && virtualElement.props.ref) {
      virtualElement.props.ref(null);
    }
    Object.keys(virtualElement.props).forEach((propName) => {
      if (propName.slice(0, 2) == "on") {
        const event = propName.toLowerCase().slice(2);
        const handler = virtualElement.props[propName];
        domElement.removeEventListener(event, handler);
      }
    });
    domElement.remove();
  }

  function updateTextNode(domElement, newVirtualElement, oldVirtualElement) {
    if (
      newVirtualElement.props.textContent !==
      oldVirtualElement.props.textContent
    ) {
      domElement.textContent = newVirtualElement.props.textContent;
    }

    domElement._virtualElement = newVirtualElement;
  }

  const mountSimpleNode = function (
    vdom,
    container,
    oldDomElement,
    parentComponent
  ) {
    let newDomElement = null;
    const nextSibling = oldDomElement && oldDomElement.nextSibling;

    if (vdom.type === "text") {
      newDomElement = document.createTextNode(vdom.props.textContent);
    } else {
      newDomElement = document.createElement(vdom.type);
      updateDomElement(newDomElement, vdom);
    }
    if (vdom.props && vdom.props.ref) {
      vdom.props.ref(newDomElement);
    }
    newDomElement._virtualElement = vdom;

    if (oldDomElement) {
      unmountNode(oldDomElement, parentComponent);
    }

    if (nextSibling) {
      container.insertBefore(newDomElement, nextSibling);
    } else {
      container.appendChild(newDomElement);
    }

    let component = vdom.component;
    if (component) {
      component.setDomElement(newDomElement);
    }

    vdom.children.forEach((child) => {
      mountElement(child, newDomElement);
    });
  };

  function updateDomElement(
    domElement,
    newVirtualElement,
    oldVirtualElement = {}
  ) {
    const newProps = newVirtualElement.props || {};
    const oldProps = oldVirtualElement.props || {};
    Object.keys(newProps).forEach((propName) => {
      const newProp = newProps[propName];
      const oldProp = oldProps[propName];
      if (newProp !== oldProp) {
        if (propName.slice(0, 2) === "on") {
          const eventName = propName.toLowerCase().slice(2);
          domElement.addEventListener(eventName, newProp, false);
          if (oldProp) {
            domElement.removeEventListener(eventName, oldProp, false);
          }
        } else if (propName === "value" || propName === "checked") {
          domElement[propName] = newProp;
        } else if (propName !== "children") {
          if (propName === "className") {
            domElement.setAttribute("class", newProps[propName]);
          } else {
            domElement.setAttribute(propName, newProps[propName]);
          }
        }
      }
    });

    Object.keys(oldProps).forEach((propName) => {
      const newProp = newProps[propName];
      const oldProp = oldProps[propName];
      if (!newProp) {
        if (propName.slice(0, 2) === "on") {
          domElement.removeEventListener(propName, oldProp, false);
        } else if (propName !== "children") {
          domElement.removeAttribute(propName);
        }
      }
    });
  }

  class Component {
    constructor(props) {
      this.props = props;
      this.state = {};
      this.prevState = {};
    }
    setState(nextState) {
      if (!this.prevState) {
        this.prevState = state;
      }
      this.state = Object.assign({}, this.state, nextState);

      let dom = this.getDomElement();
      let container = dom.parentNode;

      let newvdom = this.render();
      diff(newvdom, container, dom);
    }
    setDomElement(dom) {
      this._dom = dom;
    }
    getDomElement() {
      return this._dom;
    }
    updateProps(props) {
      this.props = props;
    }
    componentWillMount() {}
    componentDidMount() {}
    componentWillReceiveProps(nextProps) {}
    shouldComponentUpdate(nextProps, nextState) {
      return nextProps != this.props || nextState != this.state;
    }
    componentWillUpdate() {}
    componentDidUpdate() {}
    componentWillUnmount() {}
  }
  return {
    Component,
    createElement,
    render,
  };
})();
