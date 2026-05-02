const cases = [
  'Zelle payment to MITESH CHHATBAR JPM99bgxlwgv',
  'Zelle payment to Nilesh Matai 24726848199',
  'Zelle payment from MITESH CHHATBAR for "loan repayment"; Conf# 99bbz9dyq',
  'Zelle payment to Sreenidhi Iyengar Usc Conf# a1d8g08if',
  'Zelle payment to for "Gift"; Conf# hy7xfq9tm'
];
cases.forEach(c => {
  const match = c.match(/zelle payment (?:from|to) (.+?)(?: for | conf#|;|\s+[A-Z0-9]+$|$)/i);
  console.log(match ? match[1].trim() : 'No match');
});
