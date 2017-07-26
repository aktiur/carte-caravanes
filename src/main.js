import {feature} from 'topojson';
import {json} from 'd3-request';
import {geoProject} from 'd3-geo-projection';
import {geoConicConformal, geoPath, geoIdentity} from 'd3-geo';
import {line, curveCatmullRom, symbol} from 'd3-shape';
import {select} from 'd3-selection';

import './main.css';

const width = 800, height = 800;

json('topology.json', function (err, topology) {
  if (err) {
    console.error(err);
    return;
  }

  const features = ['frontieres', 'departements', 'est', 'ouest'].reduce(function (o, d) {
    return Object.assign(o, {[d]: feature(topology, topology.objects[d])})
  }, {});

  // projection officielle pour les cartes de France
  const lambert93 = geoConicConformal()
    .parallels([44, 49])
    .rotate([-3, 0])
    .fitSize([width, height], features.frontieres);

  const projectedFeatures = Object.keys(features).reduce(function (o, name) {
    return Object.assign(o, {[name]: geoProject(features[name], lambert93)});
  }, {});

  const lineGenerator = line().curve(curveCatmullRom.alpha(0.5))
    .x(d => d.geometry.coordinates[0])
    .y(d => d.geometry.coordinates[1]);

  // on va calculer les lignes correspondant aux caravanes

  const path = geoPath().projection(null);

  const svg = select('#map').append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('font-family', 'Montserrat,sans-serif');

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

  const colors = {
    'est': '#00afcb',
    'ouest': '#c9442a'
  };

  lignes.selectAll('path').data(['est', 'ouest'])
    .enter()
    .append('path')
    .attr('class', d => d)
    .attr('d', d => lineGenerator(projectedFeatures[d].features))
    .attr('fill', 'none')
    .attr('stroke', d => colors[d])
    .attr('stroke-width', 5);

  const etapeSymbol = symbol();

  projectedFeatures['est'].features.pop();

  // étapes et texte :)
  ['est', 'ouest'].map(function (caravane) {
    etapes.selectAll('.' + caravane).data(projectedFeatures[caravane].features)
      .enter()
      .append('path').attr('class', caravane)
      .attr('d', etapeSymbol)
      .attr('transform', d => `translate(${d.geometry.coordinates[0]},${d.geometry.coordinates[1]})`);

    const tGroup = textes.selectAll('.' + caravane).data(projectedFeatures[caravane].features)
      .enter()
      .append('g')
      .attr('class', caravane);

    tGroup.append('text')
      .attr('class', 'ville')
      .text(d => d.properties.ville)
      .attr('dy', '0.3em')
      .attr('font-weight', 700);

    tGroup.append('text')
      .attr('class', 'dates')
      .attr('y', 20)
      .attr('fill', '#848484')
      .text(d => d.properties.dates.map(d => +d.split('/')[0]).join(' et ') + ' août');

    tGroup.attr('transform', textPositioning(caravane));
  });

  function textPositioning(caravane) {
    if (caravane === 'ouest') {
      return d => `translate(${d.geometry.coordinates[0] + 10},${d.geometry.coordinates[1]})`;
    }
    return function(d) {
      const bbox = this.getBBox();
      return `translate(${d.geometry.coordinates[0] - bbox.width - 15},${d.geometry.coordinates[1]})`;
    };
  }
});
