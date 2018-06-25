var EnzymToken = artifacts.require("EnzymToken")

module.exports = function(deployer) {
  return deployer.deploy(EnzymToken, 1000 * 1000 * 1000, 'ZYM', 'ZYM')
};