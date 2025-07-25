export class MultiLevelsPanel extends Autodesk.Viewing.UI.DockingPanel {
  constructor(extension, id, title, options) {
    super(extension.viewer.container, id, title, options);
    this.extension = extension;
    this.container.style.left = (options.x || 0) + "px";
    this.container.style.top = (options.y || 0) + "px";
    this.container.style.width = (options.width || 320) + "px";
    this.container.style.height = (options.height || 450) + "px";
    this.container.style.resize = "none";
    this.container.style.backgroundColor = "#f5f5f5";
    this.container.style.borderRadius = "8px";
    this.container.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
    this.container.style.border = "1px solid #ddd";

    this._levels = [];
    this._levelElements = [];
  }

  initialize() {
    this.title = this.createTitleBar(this.titleLabel || this.container.id);
    this.initializeMoveHandlers(this.title);
    this.container.appendChild(this.title);

    this.content = document.createElement("div");
    this.content.style.height = "400px";
    this.content.style.padding = "15px";
    this.content.style.overflow = "auto";
    this.content.style.backgroundColor = "#fff";
    this.content.innerHTML = this._createContentHTML();
    this.container.appendChild(this.content);

    this._attachEventHandlers();
  }

  _createContentHTML() {
    return `
      <div class="multi-levels-content">
        <div class="control-section" style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px 0; color: #333; font-size: 14px; font-weight: 600;">Level Controls</h4>
          <div class="button-group" style="display: flex; gap: 6px; margin-bottom: 10px;">
            <button id="select-all-btn" class="control-button" 
                    style="flex: 1; background: #0696D7; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background-color 0.2s;">
              Select All
            </button>
            <button id="clear-all-btn" class="control-button"
                    style="flex: 1; background: #f44336; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background-color 0.2s;">
              Clear All
            </button>
          </div>
          <div class="button-group" style="display: flex; gap: 6px;">
            <button id="isolate-btn" class="control-button"
                    style="flex: 1; background: #4CAF50; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background-color 0.2s;">
              Isolate Levels
            </button>
            <button id="show-all-btn" class="control-button"
                    style="flex: 1; background: #9E9E9E; color: white; border: none; padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; transition: background-color 0.2s;">
              Show All
            </button>
          </div>
        </div>
        
        <div class="levels-section">
          <h4 style="margin: 0 0 12px 0; color: #333; font-size: 14px; font-weight: 600;">Available Levels</h4>
          <div id="levels-list" class="levels-list" style="max-height: 250px; overflow-y: auto;">
            <div style="text-align: center; color: #666; padding: 20px; font-style: italic;">
              Loading levels...
            </div>
          </div>
        </div>
        
        <div class="info-section" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
          <div id="selection-info" style="font-size: 12px; color: #666; text-align: center;">
            No levels selected
          </div>
          <div id="level-stats" style="font-size: 11px; color: #999; text-align: center; margin-top: 5px;">
            <!-- Level statistics will be shown here -->
          </div>
        </div>
      </div>
    `;
  }

  _attachEventHandlers() {
    // Select All button
    const selectAllBtn = this.content.querySelector("#select-all-btn");
    selectAllBtn.addEventListener("click", () => {
      this.extension.selectAllLevels();
    });
    selectAllBtn.addEventListener("mouseenter", () => {
      selectAllBtn.style.backgroundColor = "#0577B8";
    });
    selectAllBtn.addEventListener("mouseleave", () => {
      selectAllBtn.style.backgroundColor = "#0696D7";
    });

    // Clear All button
    const clearAllBtn = this.content.querySelector("#clear-all-btn");
    clearAllBtn.addEventListener("click", () => {
      this.extension.clearAllLevels();
    });
    clearAllBtn.addEventListener("mouseenter", () => {
      clearAllBtn.style.backgroundColor = "#d32f2f";
    });
    clearAllBtn.addEventListener("mouseleave", () => {
      clearAllBtn.style.backgroundColor = "#f44336";
    });

    // Isolate button
    const isolateBtn = this.content.querySelector("#isolate-btn");
    isolateBtn.addEventListener("click", () => {
      this.extension.isolateSelectedLevels();
    });
    isolateBtn.addEventListener("mouseenter", () => {
      isolateBtn.style.backgroundColor = "#43A047";
    });
    isolateBtn.addEventListener("mouseleave", () => {
      isolateBtn.style.backgroundColor = "#4CAF50";
    });

    // Show All button
    const showAllBtn = this.content.querySelector("#show-all-btn");
    showAllBtn.addEventListener("click", () => {
      this.extension.showAll();
    });
    showAllBtn.addEventListener("mouseenter", () => {
      showAllBtn.style.backgroundColor = "#757575";
    });
    showAllBtn.addEventListener("mouseleave", () => {
      showAllBtn.style.backgroundColor = "#9E9E9E";
    });
  }

  updateLevels(levels) {
    this._levels = levels;
    this._renderLevelsList();
    this._updateLevelStats();
  }

  _renderLevelsList() {
    const levelsList = this.content.querySelector("#levels-list");
    if (!levelsList) return;

    if (this._levels.length === 0) {
      levelsList.innerHTML = `
        <div style="text-align: center; color: #999; padding: 20px; font-style: italic;">
          No levels detected in this model
        </div>
      `;
      return;
    }

    levelsList.innerHTML = "";
    this._levelElements = [];

    this._levels.forEach((level, index) => {
      const levelItem = this._createLevelItem(level, index);
      levelsList.appendChild(levelItem);
      this._levelElements.push(levelItem);
    });

    this.updateSelection();
  }

  _createLevelItem(level, index) {
    const item = document.createElement("div");
    item.className = "level-item";
    item.style.cssText = `
      display: flex;
      align-items: center;
      padding: 10px;
      margin: 3px 0;
      background: white;
      border: 1px solid #ddd;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `level-${index}`;
    checkbox.style.cssText = `
      margin-right: 10px;
      transform: scale(1.1);
      cursor: pointer;
    `;
    checkbox.addEventListener("change", () => {
      this.extension.toggleLevel(index);
    });

    const levelInfo = document.createElement("div");
    levelInfo.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    `;

    const label = document.createElement("label");
    label.htmlFor = `level-${index}`;
    label.textContent = level.name || `Level ${index + 1}`;
    label.style.cssText = `
      cursor: pointer;
      font-weight: 600;
      color: #333;
      font-size: 13px;
    `;

    const rangeInfo = document.createElement("span");
    const heightMm = Math.round(level.zMax - level.zMin);
    rangeInfo.innerHTML = `
      <span style="font-size: 11px; color: #666;">
        Range: ${Math.round(level.zMin)}mm - ${Math.round(level.zMax)}mm
      </span>
      <span style="font-size: 11px; color: #999; margin-left: 10px;">
        Height: ${heightMm}mm
      </span>
    `;

    levelInfo.appendChild(label);
    levelInfo.appendChild(rangeInfo);

    // Add level indicator
    const indicator = document.createElement("div");
    indicator.style.cssText = `
      width: 4px;
      height: 30px;
      background: linear-gradient(to bottom, #0696D7, #04578A);
      border-radius: 2px;
      margin-left: 8px;
    `;

    // Add hover effect
    item.addEventListener("mouseenter", () => {
      if (!checkbox.checked) {
        item.style.backgroundColor = "#f8f9fa";
        item.style.borderColor = "#0696D7";
        item.style.transform = "translateY(-1px)";
        item.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
      }
    });

    item.addEventListener("mouseleave", () => {
      if (!checkbox.checked) {
        item.style.backgroundColor = "white";
        item.style.borderColor = "#ddd";
        item.style.transform = "translateY(0)";
        item.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      }
    });

    // Click on item (not checkbox) toggles selection
    item.addEventListener("click", (e) => {
      if (e.target !== checkbox) {
        checkbox.click();
      }
    });

    item.appendChild(checkbox);
    item.appendChild(levelInfo);
    item.appendChild(indicator);

    return item;
  }

  updateSelection() {
    const selectedLevels = this.extension.getSelectedLevels();

    // Update checkboxes and visual states
    this._levelElements.forEach((element, index) => {
      const checkbox = element.querySelector("input[type='checkbox']");
      const isSelected = selectedLevels.includes(index);

      checkbox.checked = isSelected;

      // Update visual state
      if (isSelected) {
        element.style.backgroundColor = "#e3f2fd";
        element.style.borderColor = "#0696D7";
        element.style.boxShadow = "0 2px 8px rgba(6,150,215,0.2)";
      } else {
        element.style.backgroundColor = "white";
        element.style.borderColor = "#ddd";
        element.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      }
    });

    // Update selection info
    this._updateSelectionInfo(selectedLevels);
  }

  _updateSelectionInfo(selectedLevels) {
    const infoElement = this.content.querySelector("#selection-info");
    if (!infoElement) return;

    if (selectedLevels.length === 0) {
      infoElement.innerHTML = `
        <span style="color: #666;">No levels selected</span>
      `;
    } else if (selectedLevels.length === 1) {
      const level = this._levels[selectedLevels[0]];
      const levelName = level?.name || `Level ${selectedLevels[0] + 1}`;
      infoElement.innerHTML = `
        <span style="color: #0696D7; font-weight: 600;">Selected: ${levelName}</span>
      `;
    } else {
      const totalHeight = selectedLevels.reduce((sum, levelIndex) => {
        const level = this._levels[levelIndex];
        return sum + (level ? level.zMax - level.zMin : 0);
      }, 0);

      infoElement.innerHTML = `
        <span style="color: #0696D7; font-weight: 600;">
          Selected: ${selectedLevels.length} levels
        </span>
        <br>
        <span style="color: #666; font-size: 11px;">
          Combined height: ${Math.round(totalHeight)}mm
        </span>
      `;
    }
  }

  _updateLevelStats() {
    const statsElement = this.content.querySelector("#level-stats");
    if (!statsElement || this._levels.length === 0) return;

    const totalLevels = this._levels.length;
    const totalHeight = this._levels.reduce(
      (sum, level) => sum + (level.zMax - level.zMin),
      0
    );
    const avgHeight = totalHeight / totalLevels;

    statsElement.innerHTML = `
      Total: ${totalLevels} levels | 
      Avg height: ${Math.round(avgHeight)}mm | 
      Total height: ${Math.round(totalHeight)}mm
    `;
  }

  // Highlight a specific level (for hover effects from outside)
  highlightLevel(levelIndex, highlight = true) {
    if (levelIndex >= 0 && levelIndex < this._levelElements.length) {
      const element = this._levelElements[levelIndex];
      const checkbox = element.querySelector("input[type='checkbox']");

      if (highlight && !checkbox.checked) {
        element.style.backgroundColor = "#fff3e0";
        element.style.borderColor = "#ff9800";
        element.style.transform = "translateY(-1px)";
      } else if (!checkbox.checked) {
        element.style.backgroundColor = "white";
        element.style.borderColor = "#ddd";
        element.style.transform = "translateY(0)";
      }
    }
  }

  // Set the panel visibility
  setVisible(visible) {
    super.setVisible(visible);
    if (visible && this._levels.length === 0) {
      // Trigger level data update when panel becomes visible
      setTimeout(() => {
        this.extension._updateLevelData();
      }, 500);
    }
  }
}
