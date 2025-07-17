import { BaseExtension } from "./BaseExtension.js";
import { SelectedIdPanel } from "./SelectedIdPanel.js";

class SelectedIdExtension extends BaseExtension {
  constructor(viewer) {
    super(viewer);
    this._selectedId = null;
    this._button = null;
  }

  load() {
    super.load();
    console.log("SelectedIdExtension loaded.");
    return true;
  }

  unload() {
    super.unload();
    if (this._button) {
      this.removeToolbarButton(this._button);
      this._button = null;
    }
    if (this._selectedIdPanel) {
      this._selectedIdPanel.setVisible(false);
      this._selectedIdPanel.uninitialize();
      this._selectedIdPanel = null;
    }
    console.log("SelectedIdExtension unloaded.");
    return true;
  }

  onToolbarCreated() {
    this._selectedIdPanel = new SelectedIdPanel(
      this,
      "SelectedIdPanel",
      "Selected ID",
      { x: 10, y: 10, width: 300, height: 150 }
    );
    this._button = this.createToolbarButton(
      "selected-id-button",
      "https://img.icons8.com/small/32/cursor.png",
      "Show Selected ID"
    );
    this._button.onClick = () => {
      this._selectedIdPanel.setVisible(!this._selectedIdPanel.isVisible());
      this._button.setState(
        this._selectedIdPanel.isVisible()
          ? Autodesk.Viewing.UI.Button.State.ACTIVE
          : Autodesk.Viewing.UI.Button.State.INACTIVE
      );
    };
  }

  onModelLoaded(model) {
    super.onModelLoaded(model);
  }

  onSelectionChanged(model, dbids) {
    super.onSelectionChanged(model, dbids);
    if (dbids && dbids.length > 0) {
      this.setSelectedId(dbids[0]); // Show the first selected ID
    } else {
      this.setSelectedId(null); // Clear selection
    }
  }

  setSelectedId(id) {
    this._selectedId = id;
    if (this._selectedIdPanel) {
      this._selectedIdPanel.updateSelectedId(id);
    }
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  "SelectedIdExtension",
  SelectedIdExtension
);
