function getUserEmail(response) {
  return response.data.user.profile.email;
}

function getFirstItem(list) {
  return list[0].name.toUpperCase();
}

function parseSettings(config) {
  const theme = config.settings.theme.name;
  const fontSize = config.settings.editor.fontSize.toString();
  return { theme, fontSize };
}

function formatAddress(user) {
  const street = user.address.street;
  const city = user.address.city;
  const zip = user.address.zip.trim();
  return street + ", " + city + " " + zip;
}
