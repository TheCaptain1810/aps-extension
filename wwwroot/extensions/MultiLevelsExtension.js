import { BaseExtension } from "./BaseExtension.js";
import { MultiLevelsPanel } from "./MultiLevelsPanel.js";

class MultiLevelsExtension extends BaseExtension {
  constructor(viewer, options) {
    super(viewer, options);
    this._button = null;
    this._panel = null;
    this._selectedLevels = new Set(); // Track multiple selected levels
    this._levelData = [];
    this._aecExtension = null;
    this._currentCutPlanes = [];

    // Event handlers
    this._onAecLevelChanged = this._onAecLevelChanged.bind(this);
  }

  async load() {
    super.load();
    console.log("MultiLevelsExtension loaded.");

    // Try to get the AEC LevelsExtension
    this._aecExtension = this.viewer.getExtension(
      "Autodesk.AEC.LevelsExtension"
    );

    // Listen for AEC level changes
    if (this._aecExtension) {
      this.viewer.addEventListener("levelChanged", this._onAecLevelChanged);
    }

    // Initialize level data extraction
    this._initializeLevelExtraction();

    return true;
  }

  unload() {
    super.unload();
    if (this._button) {
      this.removeToolbarButton(this._button);
      this._button = null;
    }
    if (this._panel) {
      this._panel.setVisible(false);
      this._panel.uninitialize();
      this._panel = null;
    }

    // Remove event listeners
    if (this._aecExtension) {
      this.viewer.removeEventListener("levelChanged", this._onAecLevelChanged);
    }

    // Clear any active cutplanes
    this._clearCutPlanes();

    console.log("MultiLevelsExtension unloaded.");
    return true;
  }

  onToolbarCreated() {
    this._panel = new MultiLevelsPanel(
      this,
      "multi-levels-panel",
      "Multi-Level Selection",
      { x: 10, y: 10, width: 320, height: 450 }
    );

    this._button = this.createToolbarButton(
      "multi-levels-button",
      "https://img.icons8.com/small/32/stack.png",
      "Multi-Level Selection"
    );

    this._button.onClick = () => {
      this._panel.setVisible(!this._panel.isVisible());
      this._button.setState(
        this._panel.isVisible()
          ? Autodesk.Viewing.UI.Button.State.ACTIVE
          : Autodesk.Viewing.UI.Button.State.INACTIVE
      );

      if (this._panel.isVisible()) {
        this._updateLevelData();
      }
    };
  }

  onModelLoaded(model) {
    super.onModelLoaded(model);
    // Delay to ensure AEC extension is loaded
    setTimeout(() => {
      this._updateLevelData();
    }, 1000);
  }

  _initializeLevelExtraction() {
    // Wait for model to be loaded
    this.viewer.addEventListener(
      Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT,
      () => {
        setTimeout(() => {
          this._extractLevelData();
        }, 1500); // Give AEC extension time to process
      }
    );
  }

  async _extractLevelData() {
    this._levelData = [];

    // Try to get level data from AEC extension first
    if (this._aecExtension && this._aecExtension.floorSelector) {
      const aecLevelData = this._aecExtension.floorSelector.floorData;
      if (aecLevelData && aecLevelData.length > 0) {
        this._levelData = aecLevelData.map((level, index) => ({
          index: index,
          name: level.name || `Level ${index + 1}`,
          zMin: level.zMin,
          zMax: level.zMax,
          guid: level.guid || `level-${index}`,
          aecLevel: level,
        }));
      }
    }

    // If no AEC data available, try to extract from model bounds
    if (this._levelData.length === 0) {
      await this._extractLevelsFromModel();
    }

    if (this._panel) {
      this._panel.updateLevels(this._levelData);
    }

    console.log("Extracted level data:", this._levelData);
  }

  async _extractLevelsFromModel() {
    const models = this.viewer.getVisibleModels();
    if (models.length === 0) return;

    const model = models[0]; // Use first model
    const bbox = model.getBoundingBox();

    if (!bbox) return;

    // Create levels based on model height - divide into 4 levels as example
    const totalHeight = bbox.max.z - bbox.min.z;
    const levelHeight = totalHeight / 4;

    for (let i = 0; i < 4; i++) {
      const zMin = bbox.min.z + i * levelHeight;
      const zMax = bbox.min.z + (i + 1) * levelHeight;

      this._levelData.push({
        index: i,
        name: `Level ${i + 1}`,
        zMin: zMin,
        zMax: zMax,
        guid: `generated-level-${i}`,
      });
    }
  }

  _onAecLevelChanged(event) {
    // When AEC extension changes level, we can react here
    console.log("AEC Level changed:", event);
    // Optionally sync with AEC selection
  }

  _updateLevelData() {
    this._extractLevelData();
  }

  // Handle level selection/deselection
  toggleLevel(levelIndex) {
    if (this._selectedLevels.has(levelIndex)) {
      this._selectedLevels.delete(levelIndex);
    } else {
      this._selectedLevels.add(levelIndex);
    }

    this._applyCutPlanes();
    this._panel.updateSelection();

    // Fire event for level selection change
    this.viewer.dispatchEvent({
      type: "multiLevelSelectionChanged",
      selectedLevels: Array.from(this._selectedLevels),
      levelData: this._levelData,
    });
  }

  // Select all levels
  selectAllLevels() {
    this._selectedLevels.clear();
    for (let i = 0; i < this._levelData.length; i++) {
      this._selectedLevels.add(i);
    }
    this._applyCutPlanes();
    this._panel.updateSelection();
  }

  // Clear all level selections
  clearAllLevels() {
    this._selectedLevels.clear();
    this._clearCutPlanes();
    this._panel.updateSelection();
  }

  // Apply cutplanes based on selected levels
  _applyCutPlanes() {
    if (this._selectedLevels.size === 0) {
      this._clearCutPlanes();
      return;
    }

    // Create separate cut plane ranges for non-contiguous levels
    const selectedLevels = Array.from(this._selectedLevels)
      .sort((a, b) => a - b)
      .map((index) => this._levelData[index])
      .filter((level) => level);

    if (selectedLevels.length === 0) return;

    // For multiple non-contiguous levels, we'll create a combined range
    // In a more advanced implementation, you might want to handle gaps differently
    let minZ = Math.min(...selectedLevels.map((l) => l.zMin));
    let maxZ = Math.max(...selectedLevels.map((l) => l.zMax));

    // Apply some padding
    const padding = (maxZ - minZ) * 0.01;
    minZ -= padding;
    maxZ += padding;

    const planes = [
      new THREE.Vector4(0, 0, -1, minZ), // Lower cutplane
      new THREE.Vector4(0, 0, 1, -maxZ), // Upper cutplane
    ];

    this.viewer.impl.setCutPlaneSet("MultiLevels", planes);
    console.log(`Applied cutplanes: ${minZ} to ${maxZ}`);
  }

  // Clear all cutplanes
  _clearCutPlanes() {
    this.viewer.impl.setCutPlaneSet("MultiLevels", null);
    console.log("Cleared cutplanes");
  }

  // Get currently selected levels
  getSelectedLevels() {
    return Array.from(this._selectedLevels);
  }

  // Get level data
  getLevelData() {
    return this._levelData;
  }

  // Check if a level is selected
  isLevelSelected(levelIndex) {
    return this._selectedLevels.has(levelIndex);
  }

  // Set level selection state
  setLevelSelection(levelIndex, selected) {
    if (selected) {
      this._selectedLevels.add(levelIndex);
    } else {
      this._selectedLevels.delete(levelIndex);
    }
    this._applyCutPlanes();
    if (this._panel) {
      this._panel.updateSelection();
    }
  }

  // Isolate specific levels (show only selected levels)
  async isolateSelectedLevels() {
    if (this._selectedLevels.size === 0) {
      // If no levels selected, show all
      this.viewer.showAll();
      this._clearCutPlanes();
      return;
    }

    // Get all objects in selected levels and isolate them
    const dbIds = await this._getObjectsInSelectedLevels();
    if (dbIds.length > 0) {
      this.viewer.isolate(dbIds);
      console.log(`Isolated ${dbIds.length} objects in selected levels`);
    } else {
      console.log("No objects found in selected levels");
      // Still apply cutplanes even if no objects found
      this._applyCutPlanes();
    }
  }

  // Get all objects within the selected level ranges
  async _getObjectsInSelectedLevels() {
    if (this._selectedLevels.size === 0 || !this.viewer.model) {
      return [];
    }

    const model = this.viewer.model;
    const dbIds = await this.findLeafNodes(model);
    const selectedDbIds = [];

    // Get ranges for all selected levels
    const selectedLevelRanges = Array.from(this._selectedLevels)
      .map((index) => this._levelData[index])
      .filter((level) => level)
      .map((level) => ({ zMin: level.zMin, zMax: level.zMax }));

    if (selectedLevelRanges.length === 0) {
      return [];
    }

    // Filter objects by z-range
    const instanceTree = model.getInstanceTree();
    if (!instanceTree) return [];

    return new Promise((resolve) => {
      const nodeBox = new Float32Array(6);

      dbIds.forEach((dbId) => {
        instanceTree.getNodeBox(dbId, nodeBox);
        const nodeZMin = nodeBox[2];
        const nodeZMax = nodeBox[5];

        // Check if object overlaps with any selected level
        const overlapsWithSelectedLevel = selectedLevelRanges.some(
          (range) => nodeZMax >= range.zMin && nodeZMin <= range.zMax
        );

        if (overlapsWithSelectedLevel) {
          selectedDbIds.push(dbId);
        }
      });

      resolve(selectedDbIds);
    });
  }

  // Show all objects and clear selection
  showAll() {
    this.viewer.showAll();
    this._clearCutPlanes();
    this.clearAllLevels();
  }

  // Get level information for a specific object
  async getObjectLevel(dbId) {
    if (!this.viewer.model) return null;

    const model = this.viewer.model;
    const instanceTree = model.getInstanceTree();
    if (!instanceTree) return null;

    return new Promise((resolve) => {
      const nodeBox = new Float32Array(6);
      instanceTree.getNodeBox(dbId, nodeBox);
      const nodeZMin = nodeBox[2];
      const nodeZMax = nodeBox[5];
      const nodeZCenter = (nodeZMin + nodeZMax) / 2;

      // Find which level this object belongs to
      const level = this._levelData.find(
        (level) => nodeZCenter >= level.zMin && nodeZCenter <= level.zMax
      );

      resolve(level);
    });
  }
}

Autodesk.Viewing.theExtensionManager.registerExtension(
  "MultiLevelsExtension",
  MultiLevelsExtension
);
