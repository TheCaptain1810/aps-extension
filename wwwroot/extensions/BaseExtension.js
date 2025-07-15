export class BaseExtension extends Autodesk.Viewing.Extension {
  constructor(viewer, options) {
    super(viewer, options);
    this._onObjectTreeChanged = (ev) => this.onModelLoaded(ev.model);
    this._onSelectionChanged = (ev) =>
      this.onSelectionChanged(ev.model, ev.dbIdArray);
    this._onIsolationChanged = (ev) =>
      this.onIsolationChanged(ev.model, ev.nodeIdArray);
  }

  load() {
    this.viewer.addEventListener(
      Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
      this._onObjectTreeChanged
    );
    this.viewer.addEventListener(
      Autodesk.Viewing.SELECTION_CHANGED_EVENT,
      this._onSelectionChanged
    );
    this.viewer.addEventListener(
      Autodesk.Viewing.ISOLATE_EVENT,
      this._onIsolationChanged
    );
    return true;
  }

  unload() {
    this.viewer.removeEventListener(
      Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT,
      this._onObjectTreeChanged
    );
    this.viewer.removeEventListener(
      Autodesk.Viewing.SELECTION_CHANGED_EVENT,
      this._onSelectionChanged
    );
    this.viewer.removeEventListener(
      Autodesk.Viewing.ISOLATE_EVENT,
      this._onIsolationChanged
    );
    return true;
  }

  onModelLoaded(model) {}

  onSelectionChanged(model, dbids) {}

  onIsolationChanged(model, dbids) {}

  findLeafNodes(model) {
    return new Promise((resolve, reject) => {
      model.getObjectTree((tree) => {
        const leaves = [];
        tree.enumNodeChildren(
          tree.getRootId(),
          (node) => {
            if (tree.getChildCount(node) === 0) {
              leaves.push(node);
            }
          },
          true
        );
        resolve(leaves);
      }, reject);
    });
  }

  async findPropertyNames(model) {
    const nodes = await this.findLeafNodes(model);
    return new Promise((resolve, reject) => {
      model.getBulkProperties(
        nodes,
        {},
        (results) => {
          let propNames = new Set();
          results.forEach((result) => {
            result.properties.forEach((prop) => {
              propNames.add(prop.displayName);
            });
          });
          resolve(Array.from(propNames.values()));
        },
        reject
      );
    });
  }
}
