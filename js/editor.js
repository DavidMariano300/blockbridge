// Editor de bloques compartido por la práctica libre y el quiz.
import { registrarBloques, TOOLBOX, categoriaVariables } from "./bloques/definiciones.js";

export const Blockly = window.Blockly;
registrarBloques(Blockly);

// Blockly mide el texto en un <canvas>: la familia debe ser concreta y estar cargada antes de inyectar.
const FUENTE = { family: '"Atkinson Hyperlegible Next", ui-sans-serif, sans-serif', weight: "600", size: 11 };
const TEMAS = {
  claro: Blockly.Theme.defineTheme("bb-claro", {
    base: Blockly.Themes.Classic, fontStyle: FUENTE, startHats: false,
    componentStyles: {
      workspaceBackgroundColour: "#f8fafc", toolboxBackgroundColour: "#ffffff", toolboxForegroundColour: "#0f172a",
      flyoutBackgroundColour: "#eef2f7", flyoutForegroundColour: "#0f172a", flyoutOpacity: 1,
      scrollbarColour: "#94a3b8", scrollbarOpacity: 0.7, insertionMarkerColour: "#3b82f6", insertionMarkerOpacity: 0.5,
      selectedGlowColour: "#3b82f6", cursorColour: "#0f172a",
    },
  }),
  oscuro: Blockly.Theme.defineTheme("bb-oscuro", {
    base: Blockly.Themes.Classic, fontStyle: FUENTE, startHats: false,
    componentStyles: {
      workspaceBackgroundColour: "#0f172a", toolboxBackgroundColour: "#1e293b", toolboxForegroundColour: "#f8fafc",
      flyoutBackgroundColour: "#1e293b", flyoutForegroundColour: "#f8fafc", flyoutOpacity: 1,
      scrollbarColour: "#64748b", scrollbarOpacity: 0.7, insertionMarkerColour: "#60a5fa", insertionMarkerOpacity: 0.5,
      selectedGlowColour: "#60a5fa", cursorColour: "#f8fafc",
    },
  }),
};
const temaActual = () => TEMAS[document.documentElement.dataset.tema === "oscuro" ? "oscuro" : "claro"];
const BLOQUES_VARIABLES = ["declarar_variable", "asignar", "variable"];

// Toolbox completa o recortada a los bloques que permite un ejercicio; las categorías vacías desaparecen.
export function toolboxPara(permitidos) {
  if (!permitidos) return TOOLBOX;
  const contents = TOOLBOX.contents.map((categoria) => {
    if (categoria.custom) return BLOQUES_VARIABLES.some((t) => permitidos.has(t)) ? categoria : null;
    const bloques = categoria.contents.filter((b) => permitidos.has(b.type));
    return bloques.length ? { ...categoria, contents: bloques } : null;
  }).filter(Boolean);
  return { ...TOOLBOX, contents };
}

export async function crearEditor(contenedor) {
  try { await document.fonts.load(`${FUENTE.weight} ${FUENTE.size}pt "Atkinson Hyperlegible Next"`); } catch { /* se usa la fuente de respaldo */ }
  let permitidos = null;
  const workspace = Blockly.inject(contenedor, {
    toolbox: toolboxPara(null),
    theme: temaActual(),
    renderer: "thrasos",
    media: "https://cdn.jsdelivr.net/npm/blockly@13.3.0/media/",
    sounds: false,
    trashcan: true,
    grid: { spacing: 24, length: 2, colour: "#94a3b8", snap: true },
    zoom: { controls: true, wheel: false, pinch: true, startScale: matchMedia("(max-width: 40rem)").matches ? 0.7 : 0.95 },
    move: { scrollbars: true, drag: true, wheel: true },
  });
  workspace.registerToolboxCategoryCallback("VARIABLES_BB", (ws) =>
    categoriaVariables(ws).filter((item) => item.kind === "button" || !permitidos || permitidos.has(item.type)));
  workspace.registerButtonCallback("crear-variable", (boton) => Blockly.Variables.createVariableButtonHandler(boton.getTargetWorkspace()));

  // El editor sigue el tema elegido en el encabezado.
  new MutationObserver(() => workspace.setTheme(temaActual()))
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });

  return {
    workspace,
    restringir(tipos) {
      permitidos = tipos;
      workspace.updateToolbox(toolboxPara(tipos));
    },
    cargar(estado) {
      workspace.clear();
      if (!estado) return;
      Blockly.serialization.workspaces.load(estado, workspace);
      // Los bloques sin posición guardada aparecen en (0, 0), pegados al borde del lienzo.
      for (const b of workspace.getTopBlocks(false)) {
        const { x, y } = b.getRelativeToSurfaceXY();
        if (x === 0 && y === 0) b.moveBy(32, 32);
      }
    },
    guardar: () => Blockly.serialization.workspaces.save(workspace),
    // Agrupa la ráfaga de eventos de un arrastre en una sola llamada.
    alCambiar(fn) {
      let pendiente = 0;
      workspace.addChangeListener((evento) => {
        if (evento.isUiEvent) return;
        clearTimeout(pendiente);
        pendiente = setTimeout(fn, 50);
      });
    },
    redimensionar: () => Blockly.svgResize(workspace),
  };
}
