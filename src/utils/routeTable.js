// [pattern, allowed methods]. Keep in sync with the routers.
const id = '[^/]+';
module.exports = [
  [/^\/tokens\/?$/, ['POST']],

  [/^\/provinces\/?$/, ['GET']],
  [new RegExp(`^/provinces/${id}/?$`), ['GET']],
  [new RegExp(`^/provinces/${id}/districts/?$`), ['GET']],
  [new RegExp(`^/provinces/${id}/readings/?$`), ['GET']],

  [new RegExp(`^/districts/${id}/?$`), ['GET']],
  [new RegExp(`^/districts/${id}/substations/?$`), ['GET']],
  [new RegExp(`^/districts/${id}/readings/?$`), ['GET']],
  [new RegExp(`^/districts/${id}/generation-summary/?$`), ['GET']],

  [new RegExp(`^/substations/${id}/?$`), ['GET']],
  [new RegExp(`^/substations/${id}/installations/?$`), ['GET']],
  [new RegExp(`^/substations/${id}/readings/?$`), ['GET']],

  [/^\/installations\/?$/, ['GET', 'POST']],
  [new RegExp(`^/installations/${id}/?$`), ['GET', 'PUT', 'PATCH', 'DELETE']],
  [new RegExp(`^/installations/${id}/detail/?$`), ['GET']],
  [new RegExp(`^/installations/${id}/last-reading/?$`), ['GET']],
  [new RegExp(`^/installations/${id}/readings/?$`), ['GET', 'POST']],
  [new RegExp(`^/installations/${id}/readings/${id}/?$`), ['GET', 'DELETE']],
];