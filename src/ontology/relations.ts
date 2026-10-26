import type { OntologyRelation } from '../schemas/ontology'

export const ONTOLOGY_RELATIONS: OntologyRelation[] = [
  // -------------------------------------------------------------------------
  // Energy source → produces → Electricity
  // -------------------------------------------------------------------------
  {
    id: 'coal-produces-electricity',
    subject: 'Coal',
    predicate: 'produces',
    object: 'Electricity',
    description: 'Coal-fired power plants generate electricity from coal combustion.',
    evidenceDomains: ['coal', 'electricity'],
  },
  {
    id: 'naturalgas-produces-electricity',
    subject: 'NaturalGas',
    predicate: 'produces',
    object: 'Electricity',
    description: 'Natural gas combined-cycle and peaker plants generate electricity.',
    evidenceDomains: ['natural-gas', 'electricity'],
  },
  {
    id: 'nuclear-produces-electricity',
    subject: 'Nuclear',
    predicate: 'produces',
    object: 'Electricity',
    description: 'Nuclear reactors generate electricity via fission.',
    evidenceDomains: ['nuclear-outages', 'electricity'],
  },
  {
    id: 'renewables-produces-electricity',
    subject: 'Renewables',
    predicate: 'produces',
    object: 'Electricity',
    description: 'Wind, solar, hydro, and geothermal resources generate electricity.',
    evidenceDomains: ['electricity', 'state-electricity-profiles'],
  },
  {
    id: 'biomass-produces-electricity',
    subject: 'DensifiedBiomass',
    predicate: 'produces',
    object: 'Electricity',
    description: 'Biomass combustion generates heat and electricity.',
    evidenceDomains: ['densified-biomass', 'electricity'],
  },

  // -------------------------------------------------------------------------
  // Sector consumes energy sources
  // -------------------------------------------------------------------------
  {
    id: 'residential-consumes-naturalgas',
    subject: 'Residential',
    predicate: 'consumes',
    object: 'NaturalGas',
    description: 'Residential sector uses natural gas for heating and cooking.',
    evidenceDomains: ['natural-gas', 'seds'],
  },
  {
    id: 'electricpower-consumes-coal',
    subject: 'ElectricPower',
    predicate: 'consumes',
    object: 'Coal',
    description: 'Electric power sector is the primary consumer of coal in the U.S.',
    evidenceDomains: ['coal'],
  },
  {
    id: 'sector-consumes-electricity',
    subject: 'Sector',
    predicate: 'consumes',
    object: 'Electricity',
    description: 'All end-use sectors consume electricity for various applications.',
    evidenceDomains: ['electricity', 'seds'],
  },

  // -------------------------------------------------------------------------
  // Trade flows
  // -------------------------------------------------------------------------
  {
    id: 'petroleum-imports-country',
    subject: 'Petroleum',
    predicate: 'imports',
    object: 'Country',
    description: 'U.S. imports crude oil from foreign countries.',
    evidenceDomains: ['crude-oil-imports', 'international'],
  },
  {
    id: 'coal-exports-customsdistrict',
    subject: 'Coal',
    predicate: 'exports',
    object: 'CustomsDistrict',
    description: 'U.S. exports coal through specific customs districts.',
    evidenceDomains: ['coal'],
  },
  {
    id: 'naturalgas-imports-country',
    subject: 'NaturalGas',
    predicate: 'imports',
    object: 'Country',
    description: 'U.S. imports natural gas from Canada and other countries by pipeline and LNG.',
    evidenceDomains: ['natural-gas'],
  },
  {
    id: 'biomass-exports-country',
    subject: 'DensifiedBiomass',
    predicate: 'exports',
    object: 'Country',
    description: 'U.S. exports wood pellets primarily to European markets.',
    evidenceDomains: ['densified-biomass'],
  },

  // -------------------------------------------------------------------------
  // Storage and transmission
  // -------------------------------------------------------------------------
  {
    id: 'naturalgas-stores-state',
    subject: 'NaturalGas',
    predicate: 'stores',
    object: 'State',
    description: 'Natural gas is stored in underground reservoirs across states.',
    evidenceDomains: ['natural-gas'],
  },
  {
    id: 'electricity-transmits-rtoregion',
    subject: 'Electricity',
    predicate: 'transmits',
    object: 'RTORegion',
    description: 'RTOs and ISOs manage bulk electricity transmission across regions.',
    evidenceDomains: ['rto'],
  },

  // -------------------------------------------------------------------------
  // Environmental
  // -------------------------------------------------------------------------
  {
    id: 'coal-emits-co2',
    subject: 'Coal',
    predicate: 'emits',
    object: 'CO2Emissions',
    description: 'Coal combustion is the highest CO2-emitting fossil fuel per unit energy.',
    evidenceDomains: ['co2-emissions', 'state-electricity-profiles'],
  },
  {
    id: 'naturalgas-emits-co2',
    subject: 'NaturalGas',
    predicate: 'emits',
    object: 'CO2Emissions',
    description: 'Natural gas combustion emits CO2, though less per Btu than coal.',
    evidenceDomains: ['co2-emissions'],
  },
  {
    id: 'petroleum-emits-co2',
    subject: 'Petroleum',
    predicate: 'emits',
    object: 'CO2Emissions',
    description: 'Petroleum products (gasoline, diesel, jet fuel) emit CO2 when combusted.',
    evidenceDomains: ['co2-emissions'],
  },

  // -------------------------------------------------------------------------
  // Spatial
  // -------------------------------------------------------------------------
  {
    id: 'facility-locatedin-state',
    subject: 'Facility',
    predicate: 'locatedIn',
    object: 'State',
    description: 'Power plants and mines are located within U.S. states.',
    evidenceDomains: ['coal', 'electricity', 'nuclear-outages'],
  },
  {
    id: 'rtoregion-locatedin-state',
    subject: 'RTORegion',
    predicate: 'locatedIn',
    object: 'State',
    description: 'RTO/ISO regions span one or more U.S. states.',
    evidenceDomains: ['rto', 'state-electricity-profiles'],
  },

  // -------------------------------------------------------------------------
  // Measurement
  // -------------------------------------------------------------------------
  {
    id: 'electricity-measuredby-capacity',
    subject: 'Electricity',
    predicate: 'measuredBy',
    object: 'Capacity',
    description: 'Electricity generation potential is measured in MW of net summer capacity.',
    evidenceDomains: ['electricity', 'state-electricity-profiles'],
  },
  {
    id: 'energyflow-measuredby-quantity',
    subject: 'EnergyFlow',
    predicate: 'measuredBy',
    object: 'Quantity',
    description: 'Energy flows are measured in physical units (Btu, tons, Mcf, kWh).',
    evidenceDomains: ['coal', 'natural-gas', 'total-energy', 'seds'],
  },

  // -------------------------------------------------------------------------
  // Temporal
  // -------------------------------------------------------------------------
  {
    id: 'energyflow-measuredat-annual',
    subject: 'EnergyFlow',
    predicate: 'measuredAt',
    object: 'Annual',
    description: 'Most EIA datasets publish annual aggregates.',
    evidenceDomains: ['coal', 'seds', 'total-energy', 'international'],
  },
  {
    id: 'electricity-measuredat-hourly',
    subject: 'Electricity',
    predicate: 'measuredAt',
    object: 'Hourly',
    description: 'RTO grid operations are reported at hourly resolution.',
    evidenceDomains: ['rto'],
  },

  // -------------------------------------------------------------------------
  // Projection
  // -------------------------------------------------------------------------
  {
    id: 'longtermprojection-forecastedby-scenario',
    subject: 'LongTermProjection',
    predicate: 'forecastedBy',
    object: 'Projection',
    description: 'AEO and IEO publish reference cases and alternative scenarios.',
    evidenceDomains: ['aeo', 'ieo'],
  },
  {
    id: 'shorttermprojection-forecastedby-scenario',
    subject: 'ShortTermProjection',
    predicate: 'forecastedBy',
    object: 'Projection',
    description: 'STEO publishes monthly supply/demand forecasts ~24 months ahead.',
    evidenceDomains: ['steo'],
  },
]

export const getRelationsForClass = (classId: string): OntologyRelation[] =>
  ONTOLOGY_RELATIONS.filter((r) => r.subject === classId || r.object === classId)
