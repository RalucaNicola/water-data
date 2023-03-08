const titleElements = document.querySelectorAll(".title");
let width = window.innerWidth || document.documentElement.clientWidth;
let height = window.innerHeight || document.documentElement.clientHeight;

const min = 1980;
const max = 2019;
const years = [...new Array(max - min + 1)].map((value, index) => {
  return min + index;
});
let currentYear = min;
const fullTimeExtent = {
  start: new Date(`${min},1,1`),
  end: new Date(`${max},1,1`),
};

let currentSection = "india";

let slides = null;

// these are needed for the layer switching when we change the time
let basinsLayer = null;
let basinsCopyLayer = null;
let basinsLayerView = null;
let basinsCopyLayerView = null;
let currentBasinsLayer = "original";

const getValueExpression = (field, yearOffset) => {
  return `Number(Split($feature.${field},'|')[${yearOffset}])`;
};

const basinsRendererSettings = {
  india: {
    colorStops: [
      {label: "-3 stdev: 0.05", value: 0.05, color: "#2f3926"},
      {label: "average: 18.629719", value: 18.62971945137156, color: "#486f1c"},
      {label: "+3 stdev: 266.17", value: 266.1712403759174, color: "#72c70c"},
    ],
    opacityStops: [
      {value: 0.05, opacity: 0.7},
      {value: 266.1712403759174, opacity: 0.95},
    ],
    valueExpression: getValueExpression("irrigation_demand", 0),
  },
  japan: {
    colorStops: [
      {label: "-3 stdev: 0.05", value: 0.05, color: "#322531"},
      {label: "average: 6.156771", value: 6.156770573566092, color: "#693b67"},
      {label: "+3 stdev: 64.99", value: 64.9885020242022, color: "#c25dbd"},
    ],
    opacityStops: [
      {value: 0.05, opacity: 0.7},
      {value: 64.9885020242022, opacity: 0.95},
    ],
    valueExpression: getValueExpression("industry_demand", 39),
  },
  mexico: {
    colorStops: [
      {label: "-3 stdev: 0.01", value: 0.01, color: "#20333a"},
      {label: "average: 1.870187", value: 1.8701870324189545, color: "#207284"},
      {label: "+3 stdev: 15.80", value: 15.798711431991151, color: "#21daff"},
    ],
    opacityStops: [
      {value: 0.01, opacity: 0.7},
      {value: 15.798711431991151, opacity: 0.95},
    ],
    valueExpression: getValueExpression("domestic_demand", 39),
  },
};

require([
  "esri/WebScene",
  "esri/views/SceneView",
  "esri/widgets/Legend",
  "esri/widgets/TimeSlider",
  "esri/core/reactiveUtils",
  "esri/core/promiseUtils",
  "esri/renderers/SimpleRenderer",
  "esri/symbols/PointSymbol3D",
  "esri/symbols/ObjectSymbol3DLayer",
  "esri/symbols/PolygonSymbol3D",
  "esri/symbols/FillSymbol3DLayer",
  "esri/renderers/visualVariables/SizeVariable",
  "esri/renderers/visualVariables/ColorVariable",
  "esri/renderers/visualVariables/OpacityVariable",
], function (
  WebScene,
  SceneView,
  Legend,
  TimeSlider,
  reactiveUtils,
  promiseUtils,
  SimpleRenderer,
  PointSymbol3D,
  ObjectSymbol3DLayer,
  PolygonSymbol3D,
  FillSymbol3DLayer,
  SizeVariable,
  ColorVariable,
  OpacityVariable
) {
  // load webscene that contains the layers for irrigation gap and demands for each hotspot:
  // https://geoxc.maps.arcgis.com/home/webscene/viewer.html?webscene=4e87f384617e4c09bdb104ad687ddc51
  const map = new WebScene({
    portalItem: {
      id: "96a1d2db23814dba839ee1515b2280a4",
    },
  });

  // display it in a view
  const view = new SceneView({
    container: "viewDiv",
    map,
    padding: {
      left: 0.4 * width,
    },
    navigation: {
      mouseWheelZoomEnabled: false,
      browserTouchPanEnabled: false,
    },
  });

  const getLayer = title => {
    return view.map.layers.find(layer => layer.title === title);
  };

  // add legend
  const legend = new Legend({
    view,
  });
  view.ui.add(legend, "bottom-left");

  // add timeslider
  const timeSliderBasins = new TimeSlider({
    container: "timeline-basins",
    mode: "instant",
    playRate: 1500,
    fullTimeExtent,
    stops: {
      dates: years.map(year => new Date(`${year},1,1`)),
    },
  });

  const end = fullTimeExtent.start;
  timeSliderBasins.timeExtent = {
    start: fullTimeExtent.start,
    end: end,
  };

  timeSliderBasins.watch("timeExtent", value => {
    const year = value.end.getFullYear();
    if (year !== currentYear) {
      currentYear = year;
      showYear(currentYear);
    }
  });

  const getIrrigationGapRenderer = () => {
    return new SimpleRenderer({
      symbol: new PointSymbol3D({
        symbolLayers: [
          new ObjectSymbol3DLayer({
            resource: {
              primitive: "cube",
            },
            width: 8000,
            anchor: "bottom",
          }),
        ],
      }),
      visualVariables: [
        new ColorVariable({
          field: "irrigation_gap",
          stops: [
            {color: [47, 57, 38, 0.7], value: 0.0001},
            {color: [114, 199, 12, 0.95], value: 0.5},
          ],
          legendOptions: {
            title: "Irrigation gap in India in 2019",
          },
        }),
        new SizeVariable({
          field: "irrigation_gap",
          axis: "height",
          stops: [
            {value: 0.0001, size: 5000},
            {value: 0.5, size: 200000},
          ],
          legendOptions: {
            showLegend: false,
          },
        }),
        new SizeVariable({
          axis: "width-and-depth",
          useSymbolValue: true,
        }),
      ],
    });
  };

  const getBasinsRenderer = country => {
    const {colorStops, opacityStops, valueExpression} = basinsRendererSettings[country];
    return new SimpleRenderer({
      symbol: new PolygonSymbol3D({
        symbolLayers: [new FillSymbol3DLayer({
          material: {color: "white"},
          outline: {
            size: 0.1,
            color: "rgba(127,127,127,0.2)", // this.#colorRampByVariable[this.#variable][0]
          },
        })],
      }),
      visualVariables: [
        new ColorVariable({
          stops: colorStops,
          valueExpression,
        }),
        new OpacityVariable({
          stops: opacityStops,
          valueExpression,
          legendOptions: {showLegend: false},
        }),
      ],
    });
  };
  view.when(() => {
    window.view = view; // for debugging
    // set the renderers client-side
    const irrigationGap = getLayer("Irrigation gap India");
    irrigationGap.renderer = getIrrigationGapRenderer();
    const waterBasinsIndia = getLayer("Hydrobasins India");
    waterBasinsIndia.renderer = getBasinsRenderer("india");
    const waterBasinsMexico = getLayer("Hydrobasins Mexico");
    waterBasinsMexico.renderer = getBasinsRenderer("mexico");
    const waterBasinsJapan = getLayer("Hydrobasins Japan");
    waterBasinsJapan.renderer = getBasinsRenderer("japan");

    // once the view loaded, get the slides, so we can change between them on scroll
    // each slide constains information about the location to zoom to and the layers that are visible
    // https://developers.arcgis.com/javascript/latest/api-reference/esri-webscene-Slide.html
    slides = view.map.presentation.slides;

    // we'll make a copy so we can alternate between this and the original
    // and have a smooth transition when the user changes the year
    basinsLayer = waterBasinsIndia;
    basinsCopyLayer = basinsLayer.clone();
    basinsCopyLayer.opacity = 0;
    basinsCopyLayer.legendEnabled = false;
    view.map.add(basinsCopyLayer);
    view.whenLayerView(basinsLayer).then(lyrView => {
      basinsLayerView = lyrView;
    });
    view.whenLayerView(basinsCopyLayer).then(lyrView => {
      basinsCopyLayerView = lyrView;
    });
  });

  const updateBasinsRendererForYear = (layer, year) => {
    const renderer = layer.renderer.clone();
    const expression = getValueExpression("irrigation_demand", year - 1980);
    // color visual variable
    renderer.visualVariables[0].valueExpression = expression;
    // opacity visual variable
    renderer.visualVariables[1].valueExpression = expression;
    layer.renderer = renderer;
  };

  const showYear = year => {
    const before = performance.now();
    if (currentBasinsLayer === "original") {
      updateBasinsRendererForYear(basinsCopyLayer, year);
      reactiveUtils
        .whenOnce(() => !basinsCopyLayerView?.updating)
        .then(() => {
          basinsCopyLayer.opacity = 1;
          basinsCopyLayer.legendEnabled = true;
          basinsLayer.opacity = 0;
          basinsLayer.legendEnabled = false;
          currentBasinsLayer = "copy";
          const after = performance.now();
          console.log("Applied renderer in (seconds): ", (after - before) / 1000);
        });
    } else {
      updateBasinsRendererForYear(basinsLayer, year);
      reactiveUtils
        .whenOnce(() => !basinsLayerView?.updating)
        .then(() => {
          basinsCopyLayer.opacity = 0;
          basinsCopyLayer.legendEnabled = false;
          basinsLayer.opacity = 1;
          basinsLayer.legendEnabled = true;
          currentBasinsLayer = "original";
          const after = performance.now();
          console.log("Applied renderer in (seconds): ", (after - before) / 1000);
        });
    }
  };

  window.addEventListener("resize", () => {
    width = window.innerWidth || document.documentElement.clientWidth;
    height = window.innerHeight || document.documentElement.clientHeight;
    view.padding = {left: 0.4 * width};
  });

  const isElementInViewport = el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.left >= 0 && rect.bottom <= height && rect.right <= width;
  };
  let abortController;
  window.onscroll = e => {
    titleElements.forEach(title => {
      if (isElementInViewport(title) && title.dataset.title !== currentSection) {
        // the title of the slide is the same as the data attribute on the title elements so I can easily select it
        currentSection = title.dataset.title;
        const slide = slides.filter(slide => slide.title.text === currentSection).getItemAt(0);
        if (slide) {
          abortController?.abort();
          abortController = new AbortController();
          slide
            .applyTo(view, {signal: abortController.signal})
            .then(() => {
              // changing to the india-waterbasins slide will make the copied basins layer invisible
              // and we want it to stay visible so that we have the smooth transitions
              if (slide.title.text === "india-waterbasins") {
                basinsCopyLayer.visible = true;
              }
            })
            .catch(error => {
              !promiseUtils.isAbortError(error) && console.error(error);
            });
        }
      }
    });
  };
});
