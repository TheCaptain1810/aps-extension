export class SelectedIdPanel extends Autodesk.Viewing.UI.DockingPanel {
  constructor(extension, id, title, options) {
    super(
      extension.viewer.container,
      id || "SelectedIdPanel",
      title || "Selected ID",
      options
    );
    this.extension = extension;
    this.container.style.left = (options.x || 0) + "px";
    this.container.style.top = (options.y || 0) + "px";
    this.container.style.width = (options.width || 300) + "px";
    this.container.style.height = (options.height || 150) + "px";
    this.container.style.resize = "both";
  }

  initialize() {
    this.title = this.createTitleBar(this.titleLabel || this.container.id);
    this.initializeMoveHandlers(this.title);
    this.container.appendChild(this.title);

    this.content = document.createElement("div");
    this.content.style.height = "120px";
    this.content.style.backgroundColor = "white";
    this.content.style.padding = "10px";
    this.content.innerHTML =
      "<p>Selected ID: <span id='selected-id'>None</span></p>";
    this.container.appendChild(this.content);
  }

  uninitialize() {
    const selectedIdElement = this.container.querySelector("#selected-id");
    if (selectedIdElement) {
      selectedIdElement.textContent = "";
    }
  }

  updateSelectedId(id) {
    const selectedIdElement = this.container.querySelector("#selected-id");
    if (selectedIdElement) {
      selectedIdElement.textContent = id ? id.toString() : "None";
    }
  }
}
