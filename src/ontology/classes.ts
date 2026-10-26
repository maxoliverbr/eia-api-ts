import type { OntologyClass } from '../schemas/ontology'

export const ONTOLOGY_CLASSES: OntologyClass[] = [
  // -------------------------------------------------------------------------
  // EnergySource
  // -------------------------------------------------------------------------
  {
    id: 'EnergySource',
    name: 'Energy Source',
    description: 'A primary or secondary source of energy.',
    sameAs: ['http://dbpedia.org/ontology/EnergySource'],
  },
  {
    id: 'Coal',
    name: 'Coal',
    parentClass: 'EnergySource',
    description: 'Solid fossil fuel — anthracite, bituminous, subbituminous, and lignite.',
    sameAs: ['http://dbpedia.org/resource/Coal', 'https://www.wikidata.org/wiki/Q132'],
  },
  {
    id: 'NaturalGas',
    name: 'Natural Gas',
    parentClass: 'EnergySource',
    description: 'Methane-rich gaseous fossil fuel, including LNG and pipeline gas.',
    sameAs: ['http://dbpedia.org/resource/Natural_gas', 'https://www.wikidata.org/wiki/Q40858'],
  },
  {
    id: 'Petroleum',
    name: 'Petroleum',
    parentClass: 'EnergySource',
    description: 'Crude oil and petroleum products.',
    sameAs: ['http://dbpedia.org/resource/Petroleum', 'https://www.wikidata.org/wiki/Q42962'],
  },
  {
    id: 'Nuclear',
    name: 'Nuclear',
    parentClass: 'EnergySource',
    description: 'Energy from nuclear fission at commercial power plants.',
    sameAs: ['http://dbpedia.org/resource/Nuclear_power', 'https://www.wikidata.org/wiki/Q7377'],
  },
  {
    id: 'Renewables',
    name: 'Renewables',
    parentClass: 'EnergySource',
    description: 'Wind, solar, hydro, geothermal, and other renewable energy sources.',
    sameAs: ['http://dbpedia.org/resource/Renewable_energy', 'https://www.wikidata.org/wiki/Q12705'],
  },
  {
    id: 'DensifiedBiomass',
    name: 'Densified Biomass',
    parentClass: 'EnergySource',
    description: 'Wood pellets and other densified biomass fuels.',
    sameAs: ['http://dbpedia.org/resource/Wood_pellet'],
  },
  {
    id: 'Electricity',
    name: 'Electricity',
    parentClass: 'EnergySource',
    description: 'Secondary energy form — generated from primary sources and delivered to end users.',
    sameAs: ['http://dbpedia.org/resource/Electricity', 'https://www.wikidata.org/wiki/Q12483'],
  },

  // -------------------------------------------------------------------------
  // Sector
  // -------------------------------------------------------------------------
  {
    id: 'Sector',
    name: 'Sector',
    description: 'An end-use sector that consumes energy.',
    sameAs: ['http://dbpedia.org/ontology/EconomicSector'],
  },
  {
    id: 'Residential',
    name: 'Residential',
    parentClass: 'Sector',
    description: 'Households and dwelling units.',
  },
  {
    id: 'Commercial',
    name: 'Commercial',
    parentClass: 'Sector',
    description: 'Businesses, institutions, and government offices.',
  },
  {
    id: 'Industrial',
    name: 'Industrial',
    parentClass: 'Sector',
    description: 'Manufacturing, mining, agriculture, and construction.',
  },
  {
    id: 'Transportation',
    name: 'Transportation',
    parentClass: 'Sector',
    description: 'Movement of people and goods by air, road, rail, and water.',
  },
  {
    id: 'ElectricPower',
    name: 'Electric Power',
    parentClass: 'Sector',
    description: 'Utilities and independent power producers that generate electricity.',
  },

  // -------------------------------------------------------------------------
  // Geography
  // -------------------------------------------------------------------------
  {
    id: 'Geography',
    name: 'Geography',
    description: 'A spatial entity at which energy data is measured or aggregated.',
  },
  {
    id: 'Country',
    name: 'Country',
    parentClass: 'Geography',
    description: 'A sovereign nation or territory (used in international data).',
    sameAs: ['http://dbpedia.org/ontology/Country'],
  },
  {
    id: 'State',
    name: 'State',
    parentClass: 'Geography',
    description: 'A U.S. state or territory.',
    sameAs: ['http://dbpedia.org/ontology/AdministrativeRegion'],
  },
  {
    id: 'RTORegion',
    name: 'RTO Region',
    parentClass: 'Geography',
    description: 'A Regional Transmission Organization or Independent System Operator (CAISO, ERCOT, ISONE, MISO, NYISO, PJM, SPP).',
  },
  {
    id: 'CustomsDistrict',
    name: 'Customs District',
    parentClass: 'Geography',
    description: 'A U.S. Customs and Border Protection district used in coal/crude oil trade data.',
  },
  {
    id: 'Facility',
    name: 'Facility',
    parentClass: 'Geography',
    description: 'A specific plant, mine, or generator-level location.',
  },

  // -------------------------------------------------------------------------
  // EnergyFlow
  // -------------------------------------------------------------------------
  {
    id: 'EnergyFlow',
    name: 'Energy Flow',
    description: 'A directional movement or transformation of energy.',
  },
  {
    id: 'Production',
    name: 'Production',
    parentClass: 'EnergyFlow',
    description: 'Extraction or generation of energy at the source.',
  },
  {
    id: 'Consumption',
    name: 'Consumption',
    parentClass: 'EnergyFlow',
    description: 'End-use of energy by a sector or geography.',
  },
  {
    id: 'Import',
    name: 'Import',
    parentClass: 'EnergyFlow',
    description: 'Energy received from a foreign country or external region.',
  },
  {
    id: 'Export',
    name: 'Export',
    parentClass: 'EnergyFlow',
    description: 'Energy sent to a foreign country or external region.',
  },
  {
    id: 'Storage',
    name: 'Storage',
    parentClass: 'EnergyFlow',
    description: 'Volumes held in underground reservoirs, tanks, or stockpiles.',
  },
  {
    id: 'Transmission',
    name: 'Transmission',
    parentClass: 'EnergyFlow',
    description: 'Bulk transfer of electricity or gas across grid or pipeline infrastructure.',
  },
  {
    id: 'RetailSales',
    name: 'Retail Sales',
    parentClass: 'EnergyFlow',
    description: 'Energy sold to end-use customers at retail prices.',
  },

  // -------------------------------------------------------------------------
  // Measurement
  // -------------------------------------------------------------------------
  {
    id: 'Measurement',
    name: 'Measurement',
    description: 'A quantitative attribute applied to an energy flow or source.',
  },
  {
    id: 'Quantity',
    name: 'Quantity',
    parentClass: 'Measurement',
    description: 'Physical volume or heat content (e.g. short tons, Mcf, Btu).',
  },
  {
    id: 'Price',
    name: 'Price',
    parentClass: 'Measurement',
    description: 'Cost per unit of energy (e.g. $/MMBtu, cents/kWh).',
  },
  {
    id: 'Expenditure',
    name: 'Expenditure',
    parentClass: 'Measurement',
    description: 'Total dollar spend on energy by a sector or geography.',
  },
  {
    id: 'Capacity',
    name: 'Capacity',
    parentClass: 'Measurement',
    description: 'Maximum power output of a generator or plant (MW, net summer capacity).',
  },

  // -------------------------------------------------------------------------
  // TemporalGranularity
  // -------------------------------------------------------------------------
  {
    id: 'TemporalGranularity',
    name: 'Temporal Granularity',
    description: 'The reporting frequency at which data is published.',
  },
  {
    id: 'Annual',
    name: 'Annual',
    parentClass: 'TemporalGranularity',
    description: 'Yearly resolution.',
  },
  {
    id: 'Monthly',
    name: 'Monthly',
    parentClass: 'TemporalGranularity',
    description: 'Monthly resolution.',
  },
  {
    id: 'Weekly',
    name: 'Weekly',
    parentClass: 'TemporalGranularity',
    description: 'Weekly resolution.',
  },
  {
    id: 'Daily',
    name: 'Daily',
    parentClass: 'TemporalGranularity',
    description: 'Daily resolution.',
  },
  {
    id: 'Hourly',
    name: 'Hourly',
    parentClass: 'TemporalGranularity',
    description: 'Hourly resolution.',
  },

  // -------------------------------------------------------------------------
  // Projection
  // -------------------------------------------------------------------------
  {
    id: 'Projection',
    name: 'Projection',
    description: 'A modeled forecast of future energy conditions under one or more scenarios.',
  },
  {
    id: 'LongTermProjection',
    name: 'Long-Term Projection',
    parentClass: 'Projection',
    description: '20–30 year outlook (Annual Energy Outlook, International Energy Outlook).',
  },
  {
    id: 'ShortTermProjection',
    name: 'Short-Term Projection',
    parentClass: 'Projection',
    description: '~24-month forecast (Short-Term Energy Outlook).',
  },

  // -------------------------------------------------------------------------
  // EnvironmentalImpact
  // -------------------------------------------------------------------------
  {
    id: 'EnvironmentalImpact',
    name: 'Environmental Impact',
    description: 'Emissions or environmental coefficients associated with energy use.',
  },
  {
    id: 'CO2Emissions',
    name: 'CO2 Emissions',
    parentClass: 'EnvironmentalImpact',
    description: 'Carbon dioxide released from combustion of fossil fuels.',
    sameAs: ['http://dbpedia.org/resource/Carbon_dioxide', 'https://www.wikidata.org/wiki/Q1933140'],
  },
  {
    id: 'CarbonCoefficient',
    name: 'Carbon Coefficient',
    parentClass: 'EnvironmentalImpact',
    description: 'Pounds of CO2 emitted per unit of energy for a given fuel.',
  },
]

export const ONTOLOGY_CLASSES_BY_ID: Readonly<Record<string, OntologyClass>> = ONTOLOGY_CLASSES.reduce(
  (acc, c) => {
    acc[c.id] = c
    return acc
  },
  {} as Record<string, OntologyClass>
)

export const getOntologyClass = (id: string): OntologyClass | undefined => ONTOLOGY_CLASSES_BY_ID[id]

export const getSubClasses = (parentId: string): OntologyClass[] =>
  ONTOLOGY_CLASSES.filter((c) => c.parentClass === parentId)
