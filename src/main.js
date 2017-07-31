import {feature} from 'topojson';
import {drag} from 'd3-drag';
import {json} from 'd3-request';
import {queue} from 'd3-queue';
import {geoProject} from 'd3-geo-projection';
import {geoConicConformal, geoPath, geoIdentity} from 'd3-geo';
import {line, curveCatmullRom, symbol} from 'd3-shape';
import {select, event as d3event} from 'd3-selection';

import './main.css';

const width = 800, height = 800;
const fontSize = 16;


queue()
  .defer(json, 'topology.json')
  .defer(getLabelPositions, 'label-positions.json')
  .await(function (err, topology, labelPos) {
  if (err) {
    console.error('Got error');
    console.log(err);
    return;
  }

  const features = ['frontieres', 'departements', 'est', 'ouest'].reduce(function (o, d) {
    return Object.assign(o, {[d]: feature(topology, topology.objects[d])});
  }, {});

  // projection officielle pour les cartes de France
  const lambert93 = geoConicConformal()
    .parallels([44, 49])
    .rotate([-3, 0])
    .fitSize([width, height], features.frontieres);

  const projectedFeatures = Object.keys(features).reduce(function (o, name) {
    return Object.assign(o, {[name]: geoProject(features[name], lambert93)});
  }, {});

  labelPos = labelPos || {};
  ['est', 'ouest'].map(function(caravane) {
    for (let etape of projectedFeatures[caravane].features) {
      if(!(etape.properties.ville in labelPos)) {
        labelPos[etape.properties.ville] = etape.geometry.coordinates;
      }
    }
  });

  const curve = curveCatmullRom.alpha(1);

  const lineGenerator = line().curve(curve)
    .x(d => d.geometry.coordinates[0])
    .y(d => d.geometry.coordinates[1]);

  // on va calculer les lignes correspondant aux caravanes

  const path = geoPath().projection(null);

  const app = select('#map');

  const svg = app.append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('font-family', 'Montserrat,sans-serif')
    .attr('font-size', 16);

  // Frontière
  svg.append('path').attr('class', 'frontieres')
    .datum(projectedFeatures.frontieres)
    .attr('d', path)
    .attr('fill', '#e7e7e7')
    .attr('stroke', 'none');

  // Départements
  svg.append('path').attr('class', 'departements')
    .datum(projectedFeatures.departements)
    .attr('d', path)
    .attr('fill', 'none')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', 0.7);

  const lignes = svg.append('g').attr('class', 'caravanes');
  const etapes = svg.append('g').attr('class', 'etapes');
  const textes = svg.append('g').attr('class', 'textes');

  const colors = [
    '#00afcb',
    '#c9442a'
  ];

  const lignesData = [
    projectedFeatures['est'].features.slice(),
    projectedFeatures['ouest'].features.slice()
  ];
  lignesData[0].splice(-1, 0, {geometry: {coordinates: [634, 670]}});
  lignesData[1].splice(-1, 0, {geometry: {coordinates: [630, 670]}});

  lignes.selectAll('path').data(lignesData)
    .enter()
    .append('path')
    .attr('d', lineGenerator)
    .attr('fill', 'none')
    .attr('stroke', (d, i) => colors[i])
    .attr('stroke-width', 5);

  const etapeSymbol = symbol();

  // éviter de rajouter deux fois Marseille
  projectedFeatures['est'].features.pop();

  const dragger = drag().on("drag", dragged).container(textes.node());

  // étapes et texte :)
  ['est', 'ouest'].map(function (caravane) {
    etapes.selectAll('.' + caravane).data(projectedFeatures[caravane].features)
      .enter()
      .append('path').attr('class', caravane)
      .attr('d', etapeSymbol)
      .attr('transform', d => `translate(${d.geometry.coordinates[0]},${d.geometry.coordinates[1]})`);
  });

  const labels = projectedFeatures['est'].features.concat(projectedFeatures['ouest'].features).map(function(f) {
    const ville = f.properties.ville;
    const [x, y] = labelPos[ville];
    return {ville, x, y, dates: f.properties.dates.map(d => +d.split('/')[0]).join(' et ') + ' août'};
  });

  const tGroup = textes.selectAll('.label-group').data(labels)
    .enter()
    .append('g')
    .attr('transform', d => `translate(${d.x},${d.y})`)
    .attr('class', `label-group`)
    .call(dragger);

  tGroup.append('text')
    .attr('class', 'ville')
    .text(d => d.ville)
    .attr('font-weight', 700);

  tGroup.append('text')
    .attr('class', 'dates')
    .attr('y', fontSize * 1.1)
    .attr('fill', '#848484')
    .text(d => d.dates);

  const labelsTextArea = app.append('textarea')
    .attr('rows', '20')
    .attr('cols', '50');

  updateTextArea();

  function updateTextArea() {
    labelsTextArea.text(JSON.stringify(labelPos));
  }

  function dragged(d) {
    select(this).attr("transform", `translate(${d.x = d3event.x},${d.y = d3event.y})`);
    labelPos[d.ville] = [d3event.x, d3event.y];
    updateTextArea();
  }
});

function getLabelPositions(filename, cb) {
  json(filename, function(err, data) {
    if (err) {
      if (err.target.status === 404) {
        cb(null, null);
      } else {
        cb(err);
      }
    } else {
      cb(null, data);
    }
  });
}
