"use strict";
const TALLY_FORM_URL = "https://tally.so/r/D48eOX";
const MAKE_WEBHOOK_URL =
  "https://hook.eu1.make.com/h42nrc39k93lojcw8yerqip3bophfroe";

const MAKE_WEBHOOK_TIMEOUT_MS = 20000;

const RESERVATION_PARAMS = [
  "centro",
  "municipio",
  "grupo",
  "aula",
  "actividad",
  "fecha",
  "inicio",
  "fin",
];

const ICONS = {
  check: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 13L9.5 17.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  cross: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18A1.5 1.5 0 003.09 20.5H20.91A1.5 1.5 0 0022.18 18L13.71 3.86A1.5 1.5 0 0010.29 3.86Z"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
};

/* -------------------------------------------------------------------------- */
/* Configuración de estados.                                                  */
/*                                                                            */
/* Para añadir un nuevo estado en el futuro (por ejemplo "invalid"), basta    */
/* con añadir una entrada aquí: el resto del código no necesita cambios.      */
/* -------------------------------------------------------------------------- */

const STATE_CONFIG = {
  success: {
    theme: "success",
    icon: "check",
    title: "Reserva confirmada",
    message: "La actividad se ha registrado correctamente.",
    showDetails: true,
    buttonLabel: "Nueva reserva",
  },
  conflict: {
    theme: "error",
    icon: "cross",
    title: "Horario no disponible",
    message:
      "No se ha podido crear la reserva porque existe un conflicto con otra actividad programada.",
    showDetails: false,
    buttonLabel: "Volver al formulario",
  },
  invalid: {
    theme: "warning",
    icon: "warning",
    title: "Datos no válidos",
    message: "La solicitud contiene datos incompletos o incorrectos.",
    showDetails: false,
    buttonLabel: "Volver al formulario",
  },
  error: {
    theme: "warning",
    icon: "warning",
    title: "No se ha podido completar",
    message:
      "Ha ocurrido un problema al procesar la reserva. Por favor, inténtalo de nuevo.",
    showDetails: false,
    buttonLabel: "Volver al formulario",
  },
};

// Se usa cuando no llega ningún parámetro "estado" en la URL.
const EMPTY_STATE = {
  theme: "neutral",
  icon: "info",
  title: "Sin información de reserva",
  message:
    "Abre este enlace desde el proceso de reserva para ver aquí el resultado.",
  showDetails: false,
  buttonLabel: "Ir al formulario",
};

// Se usa cuando llega un valor de "estado" que no está en STATE_CONFIG.
const UNKNOWN_STATE = {
  theme: "warning",
  icon: "warning",
  title: "Estado desconocido",
  message: "No se ha reconocido el resultado de la reserva.",
  showDetails: false,
  buttonLabel: "Volver al formulario",
};

const DETAIL_FIELDS = [
  { param: "centro", label: "Centro" },
  { param: "municipio", label: "Municipio" },
  { param: "grupo", label: "Grupo" },
  { param: "aula", label: "Aula" },
  { param: "actividad", label: "Actividad" },
  { param: "fecha", label: "Fecha", format: formatFecha },
  { param: "inicio", label: "Horario", combineWith: "fin" },
];

function formatFecha(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/* -------------------------------------------------------------------------- */
/* Render helpers                                                             */
/* -------------------------------------------------------------------------- */

function setIcon(container, iconKey, theme) {
  container.innerHTML = ICONS[iconKey] || ICONS.info;
  container.parentElement.classList.remove(
    "theme-success",
    "theme-error",
    "theme-warning",
    "theme-neutral",
  );
  container.parentElement.classList.add(`theme-${theme}`);
}

function renderDetails(listEl, sectionEl, params) {
  listEl.textContent = "";
  let hasAny = false;

  for (const field of DETAIL_FIELDS) {
    const rawValue = params.get(field.param);
    if (!rawValue) continue;

    let value = field.format ? field.format(rawValue) : rawValue;
    if (field.combineWith) {
      const endValue = params.get(field.combineWith);
      if (endValue) value = `${value} – ${endValue}`;
    }

    const li = document.createElement("li");

    const iconEl = document.createElement("span");
    iconEl.className = "detail-icon";
    iconEl.setAttribute("aria-hidden", "true");

    const textWrap = document.createElement("span");
    textWrap.className = "detail-text";

    const labelEl = document.createElement("span");
    labelEl.className = "detail-label";
    labelEl.textContent = field.label;

    const valueEl = document.createElement("span");
    valueEl.className = "detail-value";
    valueEl.textContent = value;

    textWrap.appendChild(labelEl);
    textWrap.appendChild(valueEl);
    li.appendChild(iconEl);
    li.appendChild(textWrap);
    listEl.appendChild(li);

    hasAny = true;
  }

  sectionEl.hidden = !hasAny;
}

function renderReason(boxEl, textEl, params, estado) {
  const motivo = params.get("motivo");
  if (!motivo || estado === "success") {
    boxEl.hidden = true;
    return;
  }
  textEl.textContent = motivo;
  boxEl.hidden = false;
}

/* -------------------------------------------------------------------------- */
/* Página resultado.html                                                      */
/* -------------------------------------------------------------------------- */

function initResultadoPage() {
  const params = new URLSearchParams(window.location.search);
  const estado = params.get("estado");

  let config;
  if (!estado) {
    config = EMPTY_STATE;
  } else {
    config = STATE_CONFIG[estado] || UNKNOWN_STATE;
  }

  const statusIconEl = document.getElementById("statusIcon");
  const titleEl = document.getElementById("title");
  const messageEl = document.getElementById("message");
  const reasonBoxEl = document.getElementById("reasonBox");
  const reasonTextEl = document.getElementById("reasonText");
  const detailsSectionEl = document.getElementById("detailsSection");
  const detailsListEl = document.getElementById("detailsList");
  const actionButtonEl = document.getElementById("actionButton");

  setIcon(statusIconEl, config.icon, config.theme);
  titleEl.textContent = config.title;
  messageEl.textContent = config.message;

  renderReason(reasonBoxEl, reasonTextEl, params, estado);

  if (config.showDetails) {
    renderDetails(detailsListEl, detailsSectionEl, params);
  } else {
    detailsSectionEl.hidden = true;
  }

  actionButtonEl.textContent = config.buttonLabel;
  actionButtonEl.href = TALLY_FORM_URL;
}

/* -------------------------------------------------------------------------- */
/* Página index.html                                                          */
/* -------------------------------------------------------------------------- */

function initIndexPage() {
  const formButtonEl = document.getElementById("formButton");
  formButtonEl.href = TALLY_FORM_URL;
}

/* -------------------------------------------------------------------------- */
/* Página procesando.html                                                     */
/* -------------------------------------------------------------------------- */

function buildResultadoUrl(params, estado, motivo) {
  const out = new URLSearchParams();
  out.set("estado", estado);
  if (motivo) out.set("motivo", motivo);
  for (const key of RESERVATION_PARAMS) {
    const value = params.get(key);
    if (value) out.set(key, value);
  }
  return `resultado.html?${out.toString()}`;
}

async function initProcesandoPage() {
  const params = new URLSearchParams(window.location.search);

  // Sin los datos mínimos de la reserva no hay nada que comprobar: ir
  // directamente a resultado.html (mostrará el estado genérico "sin información").
  if (!params.get("fecha") || !params.get("inicio")) {
    window.location.replace("resultado.html");
    return;
  }

  const webhookUrl = new URL(MAKE_WEBHOOK_URL);
  for (const key of RESERVATION_PARAMS) {
    const value = params.get(key);
    if (value) webhookUrl.searchParams.set(key, value);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    MAKE_WEBHOOK_TIMEOUT_MS,
  );

  try {
    const response = await fetch(webhookUrl.toString(), {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Webhook respondió ${response.status}`);

    const data = await response.json();
    const estado = typeof data.estado === "string" ? data.estado : "error";
    const motivo = typeof data.motivo === "string" ? data.motivo : "";

    window.location.replace(buildResultadoUrl(params, estado, motivo));
  } catch (err) {
    window.location.replace(buildResultadoUrl(params, "error"));
  } finally {
    clearTimeout(timeoutId);
  }
}

/* -------------------------------------------------------------------------- */
/* Init                                                                        */
/* -------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("statusIcon")) {
    initResultadoPage();
  } else if (document.getElementById("procesandoIcon")) {
    initProcesandoPage();
  } else if (document.getElementById("formButton")) {
    initIndexPage();
  }
});
