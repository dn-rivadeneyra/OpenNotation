import { describe, expect, it } from "vitest";

import { modelModule } from "../src/core/model/index.js";
import { temporalModule } from "../src/core/temporal/index.js";
import { engravingModule } from "../src/core/engraving/index.js";
import { renderingModule } from "../src/core/rendering/index.js";
import { editorModule } from "../src/core/editor/index.js";
import { playbackModule } from "../src/core/playback/index.js";
import { fontsModule } from "../src/core/fonts/index.js";
import { serializationModule } from "../src/core/serialization/index.js";
import { webPlatformModule } from "../src/platform/web/index.js";
import { reactBindingsModule } from "../src/bindings/react/index.js";

describe("phase 0 smoke", () => {
  it("exports model module", () => {
    expect(modelModule).toBeTruthy();
  });

  it("exports temporal module", () => {
    expect(temporalModule).toBeTruthy();
  });

  it("exports engraving module", () => {
    expect(engravingModule).toBeTruthy();
  });

  it("exports rendering module", () => {
    expect(renderingModule).toBeTruthy();
  });

  it("exports editor module", () => {
    expect(editorModule).toBeTruthy();
  });

  it("exports playback module", () => {
    expect(playbackModule).toBeTruthy();
  });

  it("exports fonts module", () => {
    expect(fontsModule).toBeTruthy();
  });

  it("exports serialization module", () => {
    expect(serializationModule).toBeTruthy();
  });

  it("exports web platform module", () => {
    expect(webPlatformModule).toBeTruthy();
  });

  it("exports react bindings module", () => {
    expect(reactBindingsModule).toBeTruthy();
  });
});
