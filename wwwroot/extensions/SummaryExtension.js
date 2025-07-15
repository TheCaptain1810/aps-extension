import { BaseExtension } from "./BaseExtension";

class SummaryExtension extends BaseExtension {
  constructor(viewer, options) {
    super(viewer, options);
  }

  load() {
    super.load();
    console.log("SummaryExtension loaded");
    return true;
  }

  unload() {
    super.unload();
    console.log("SummaryExtension unloaded");
    return true;
  }

  onModelLoaded(model) {
    super.onModelLoaded(model);
    this.update();
  }

  onSelectionChanged(model, dbids) {
    super.onSelectionChanged(model, dbids);
    this.update();
  }

  onIsolationChanged(model, dbids) {
    super.onIsolationChanged(model, dbids);
    this.update();
  }

  async update() {
    //TODO
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  "SummaryExtension",
  SummaryExtension
);
