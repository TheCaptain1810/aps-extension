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
    // Wait for model to be loaded and AEC extension to be ready
    this.viewer.addEventListener(
      Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT,
      () => {
        // Try multiple times to get AEC extension as it might not be loaded yet
        this._tryGetAecExtension();
      }
    );
  }

  async _tryGetAecExtension(retryCount = 0) {
    const maxRetries = 10;

    // Try to get the AEC LevelsExtension
    this._aecExtension = this.viewer.getExtension(
      "Autodesk.AEC.LevelsExtension"
    );

    if (this._aecExtension) {
      console.log("AEC LevelsExtension found!");

      // Listen for AEC level changes
      this.viewer.addEventListener("levelChanged", this._onAecLevelChanged);

      // Wait a bit more for AEC extension to process the model
      setTimeout(() => {
        this._extractLevelData();
      }, 2000);
    } else if (retryCount < maxRetries) {
      console.log(
        `AEC LevelsExtension not ready yet, retrying... (${
          retryCount + 1
        }/${maxRetries})`
      );
      setTimeout(() => {
        this._tryGetAecExtension(retryCount + 1);
      }, 1000);
    } else {
      console.log(
        "AEC LevelsExtension not available, using fallback level extraction"
      );
      this._extractLevelData();
    }
  }

  async _extractLevelData() {
    this._levelData = [];

    // Try to get level data from AEC extension first
    if (this._aecExtension && this._aecExtension.floorSelector) {
      const aecLevelData = this._aecExtension.floorSelector.floorData;
      console.log("Raw AEC level data:", aecLevelData);

      if (aecLevelData && aecLevelData.length > 0) {
        this._levelData = aecLevelData.map((level, index) => {
          // Extract proper level name - AEC data often has real level names like "Level 1", "Ground Floor", etc.
          const levelName =
            level.name || level.levelName || `Level ${index + 1}`;

          // Validate level bounds
          const zMin = typeof level.zMin === "number" ? level.zMin : 0;
          let zMax = typeof level.zMax === "number" ? level.zMax : zMin + 3000;

          // Check for invalid/corrupted zMax values (close to max 32-bit integer)
          const MAX_VALID_Z = 1000000; // 1 million mm = 1000m should be enough for any building
          if (zMax > MAX_VALID_Z || zMax <= zMin) {
            console.warn(
              `Invalid zMax detected for level "${levelName}": ${zMax}, using default height`
            );
            // For parapet and roof levels, use a smaller default height
            const defaultHeight =
              levelName.toLowerCase().includes("parapet") ||
              levelName.toLowerCase().includes("roof")
                ? 1000
                : 3000;
            zMax = zMin + defaultHeight;
          }

          // Log individual level data for debugging
          console.log(
            `Level ${index}: "${levelName}" - zMin: ${zMin}, zMax: ${zMax}, height: ${
              zMax - zMin
            }`
          );

          return {
            index: index,
            name: levelName,
            zMin: zMin,
            zMax: zMax,
            guid: level.guid || `level-${index}`,
            aecLevel: level,
            // Include any additional AEC properties that might be useful
            isArtificialLevel: level.isArtificialLevel || false,
            elevation: level.elevation,
          };
        });

        console.log("Successfully extracted AEC level data:", this._levelData);
      }
    }

    // If no AEC data available, try to extract from AEC model data directly
    if (this._levelData.length === 0 && this._aecExtension) {
      await this._extractFromAecModelData();
    }

    // If still no data, fall back to model bounds
    if (this._levelData.length === 0) {
      console.log(
        "No AEC data found, using fallback level extraction from model bounds"
      );
      await this._extractLevelsFromModel();
    }

    if (this._panel) {
      this._panel.updateLevels(this._levelData);
    }

    console.log("Final extracted level data:", this._levelData);
  }

  async _extractFromAecModelData() {
    try {
      // Try to access the AEC model data directly
      const models = this.viewer.getVisibleModels();
      if (models.length === 0) return;

      for (const model of models) {
        const bubbleNode = model.getDocumentNode();
        if (bubbleNode) {
          // Try to get AEC model data from the document
          const aecModelData = await Autodesk.Viewing.Document.getAecModelData(
            bubbleNode
          );
          if (
            aecModelData &&
            aecModelData.levels &&
            aecModelData.levels.length > 0
          ) {
            console.log(
              "Found AEC model data with levels:",
              aecModelData.levels
            );

            this._levelData = aecModelData.levels.map((level, index) => {
              // Calculate zMin and zMax from elevation and height
              const elevation = level.elevation || 0;
              const height = level.height || 3000; // Default height if not specified

              return {
                index: index,
                name: level.name || `Level ${index + 1}`,
                zMin: elevation,
                zMax: elevation + height,
                guid: level.guid || `aec-level-${index}`,
                aecLevel: level,
                elevation: elevation,
                height: height,
              };
            });

            console.log(
              "Successfully extracted from AEC model data:",
              this._levelData
            );
            break; // Use the first model with AEC data
          }
        }
      }
    } catch (error) {
      console.log("Could not extract from AEC model data:", error);
    }
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
    // If AEC extension is not loaded yet, try to get it first
    if (!this._aecExtension) {
      this._tryGetAecExtension();
    } else {
      this._extractLevelData();
    }
  }

  // Handle level selection/deselection
  toggleLevel(levelIndex) {
    const level = this._levelData[levelIndex];
    const levelName = level ? level.name : `Unknown level ${levelIndex}`;

    if (this._selectedLevels.has(levelIndex)) {
      this._selectedLevels.delete(levelIndex);
      console.log(`Deselected level: "${levelName}" (index: ${levelIndex})`);
    } else {
      this._selectedLevels.add(levelIndex);
      console.log(`Selected level: "${levelName}" (index: ${levelIndex})`);
      if (level) {
        console.log(
          `  Level bounds: zMin=${level.zMin}, zMax=${level.zMax}, height=${
            level.zMax - level.zMin
          }`
        );
      }
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

    console.log("Selected levels for cutplane application:", selectedLevels);

    // For multiple non-contiguous levels, we'll create a combined range
    // In a more advanced implementation, you might want to handle gaps differently
    let minZ = Math.min(...selectedLevels.map((l) => l.zMin));
    let maxZ = Math.max(...selectedLevels.map((l) => l.zMax));

    console.log(
      `Original range - minZ: ${minZ}, maxZ: ${maxZ}, height: ${maxZ - minZ}`
    );

    // Apply some padding
    const padding = (maxZ - minZ) * 0.01;
    minZ -= padding;
    maxZ += padding;

    console.log(`With padding - minZ: ${minZ}, maxZ: ${maxZ}`);

    const planes = [
      new THREE.Vector4(0, 0, -1, minZ), // Lower cutplane
      new THREE.Vector4(0, 0, 1, -maxZ), // Upper cutplane
    ];

    this.viewer.impl.setCutPlaneSet("MultiLevels", planes);
    console.log(`Applied cutplanes: ${minZ} to ${maxZ}`);

    // Log which levels are affected for debugging
    selectedLevels.forEach((level) => {
      console.log(`  - Level "${level.name}": ${level.zMin} to ${level.zMax}`);
    });
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
