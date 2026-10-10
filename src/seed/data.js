const GEOGRAPHY = [
  { name: 'Western', code: 'WP', districts: ['Colombo', 'Gampaha', 'Kalutara'] },
  { name: 'Central', code: 'CP', districts: ['Kandy', 'Matale', 'Nuwara Eliya'] },
  { name: 'Southern', code: 'SP', districts: ['Galle', 'Matara', 'Hambantota'] },
  { name: 'Northern', code: 'NP', districts: ['Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu'] },
  { name: 'Eastern', code: 'EP', districts: ['Batticaloa', 'Ampara', 'Trincomalee'] },
  { name: 'North Western', code: 'NW', districts: ['Kurunegala', 'Puttalam'] },
  { name: 'North Central', code: 'NC', districts: ['Anuradhapura', 'Polonnaruwa'] },
  { name: 'Uva', code: 'UV', districts: ['Badulla', 'Monaragala'] },
  { name: 'Sabaragamuwa', code: 'SG', districts: ['Ratnapura', 'Kegalle'] },
];

// Districts that get an additional substation (so 25 + 5 = 30)
const EXTRA_SUBSTATIONS = ['Colombo', 'Colombo', 'Gampaha', 'Kandy', 'Galle'];

module.exports = { GEOGRAPHY, EXTRA_SUBSTATIONS };