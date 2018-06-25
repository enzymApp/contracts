// based on https://github.com/ConsenSys/Tokens

const { assertRevert } = require('./helpers/assertRevert');

const Token = artifacts.require('EnzymToken');
let token;

const INITIAL_SUPPLY = 1000 * 1000 * 1000
const DECIMALS = 18
const INITIAL_SUPPLY_LONG = web3.toBigNumber(INITIAL_SUPPLY * 10 ** DECIMALS)

contract('EIP20', (accounts) => {
  beforeEach(async () => {
    token = await Token.new(INITIAL_SUPPLY, 'ZYM', 'ZYM', { from: accounts[0] });
  });

  it('creation: should create an initial balance of INITIAL_SUPPLY for the creator', async () => {
    const balance = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance.toString(), INITIAL_SUPPLY_LONG.toString());
  });

  it('creation: test correct setting of vanity information', async () => {
    const name = await token.name.call();
    assert.strictEqual(name, 'ZYM');

    const decimals = await token.decimals.call();
    assert.strictEqual(decimals.toNumber(), DECIMALS);

    const symbol = await token.symbol.call();
    assert.strictEqual(symbol, 'ZYM');
  });

//   it('creation: should succeed in creating over 2^256 - 1 (max) tokens', async () => {
//     // 2^256 - 1
//     const token2 = await Token.new('115792089237316195423570985008687907853269984665640564039457584007913129639935', 'ZYM', 'ZYM', { from: accounts[0] });
//     const totalSupply = await token2.totalSupply();
//     const match = totalSupply.equals('1.15792089237316195423570985008687907853269984665640564039457584007913129639935e+77');
//     assert(match, 'result is not correct');
//   });

  // TRANSFERS
  // normal transfers without approvals
  it('transfers: ether transfer should be reversed.', async () => {
    const balanceBefore = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balanceBefore.toString(), INITIAL_SUPPLY_LONG.toString());

    await assertRevert(new Promise((resolve, reject) => {
      web3.eth.sendTransaction({ from: accounts[0], to: token.address, value: web3.toWei('10', 'Ether') }, (err, res) => {
        if (err) { reject(err); }
        resolve(res);
      });
    }));

    const balanceAfter = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balanceAfter.toString(), INITIAL_SUPPLY_LONG.toString());
  });

  it('transfers: should transfer INITIAL_SUPPLY_LONG to accounts[1] with accounts[0] having INITIAL_SUPPLY_LONG', async () => {
    await token.transfer(accounts[1], INITIAL_SUPPLY_LONG, { from: accounts[0] });
    const balance = await token.balanceOf.call(accounts[1]);
    assert.strictEqual(balance.toString(), INITIAL_SUPPLY_LONG.toString());
  });

  it('transfers: should fail when trying to transfer 10001 to accounts[1] with accounts[0] having INITIAL_SUPPLY_LONG', async () => {
    await assertRevert(
      token.transfer(accounts[1], INITIAL_SUPPLY_LONG.add(1), { from: accounts[0] })
    );
  });

  it('transfers: should handle zero-transfers normally', async () => {
    assert(await token.transfer(accounts[1], 0, { from: accounts[0] }), 'zero-transfer has failed');
  });

  // NOTE: testing uint256 wrapping is impossible since you can't supply > 2^256 -1
  // todo: transfer max amounts

  // APPROVALS
  it('approvals: msg.sender should approve 100 to accounts[1]', async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    const allowance = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance.toNumber(), 100);
  });

  // bit overkill. But is for testing a bug
  it('approvals: msg.sender approves accounts[1] of 100 & withdraws 20 once.', async () => {
    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toString(), INITIAL_SUPPLY_LONG.toString());

    await token.approve(accounts[1], 100, { from: accounts[0] }); // 100
    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 0, 'balance2 not correct');

    await token.transferFrom.call(accounts[0], accounts[2], 20, { from: accounts[1] });
    await token.allowance.call(accounts[0], accounts[1]);
    await token.transferFrom(accounts[0], accounts[2], 20, { from: accounts[1] }); // -20
    const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 80); // =80

    const balance22 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance22.toNumber(), 20);

    const balance02 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance02.toString(), INITIAL_SUPPLY_LONG.minus(20).toString());
  });

  // should approve 100 of msg.sender & withdraw 50, twice. (should succeed)
  it('approvals: msg.sender approves accounts[1] of 100 & withdraws 20 twice.', async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 100);

    await token.transferFrom(accounts[0], accounts[2], 20, { from: accounts[1] });
    const allowance012 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance012.toNumber(), 80);

    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 20);

    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toString(), INITIAL_SUPPLY_LONG.minus(20).toString());

    // FIRST tx done.
    // onto next.
    await token.transferFrom(accounts[0], accounts[2], 20, { from: accounts[1] });
    const allowance013 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance013.toNumber(), 60);

    const balance22 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance22.toNumber(), 40);

    const balance02 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance02.toString(), INITIAL_SUPPLY_LONG.minus(40).toString());
  });

  // should approve 100 of msg.sender & withdraw 50 & 60 (should fail).
  it('approvals: msg.sender approves accounts[1] of 100 & withdraws 50 & 60 (2nd tx should fail)', async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    const allowance01 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance01.toNumber(), 100);

    await token.transferFrom(accounts[0], accounts[2], 50, { from: accounts[1] });
    const allowance012 = await token.allowance.call(accounts[0], accounts[1]);
    assert.strictEqual(allowance012.toNumber(), 50);

    const balance2 = await token.balanceOf.call(accounts[2]);
    assert.strictEqual(balance2.toNumber(), 50);

    const balance0 = await token.balanceOf.call(accounts[0]);
    assert.strictEqual(balance0.toString(), INITIAL_SUPPLY_LONG.minus(50).toString());

    // FIRST tx done.
    // onto next.
    await assertRevert(token.transferFrom.call(accounts[0], accounts[2], 60, { from: accounts[1] }));
  });

  it('approvals: attempt withdrawal from account with no allowance (should fail)', async () => {
    await assertRevert(token.transferFrom.call(accounts[0], accounts[2], 60, { from: accounts[1] }));
  });

  it('approvals: allow accounts[1] 100 to withdraw from accounts[0]. Withdraw 60 and then approve 0 & attempt transfer.', async () => {
    await token.approve(accounts[1], 100, { from: accounts[0] });
    await token.transferFrom(accounts[0], accounts[2], 60, { from: accounts[1] });
    await token.approve(accounts[1], 0, { from: accounts[0] });
    await assertRevert(token.transferFrom.call(accounts[0], accounts[2], 10, { from: accounts[1] }));
  });

  it('approvals: approve max (2^256 - 1)', async () => {
    await token.approve(accounts[1], '115792089237316195423570985008687907853269984665640564039457584007913129639935', { from: accounts[0] });
    const allowance = await token.allowance(accounts[0], accounts[1]);
    assert(allowance.equals('1.15792089237316195423570985008687907853269984665640564039457584007913129639935e+77'));
  });

  /* eslint-disable no-underscore-dangle */
  it('events: should fire Transfer event properly', async () => {
    const res = await token.transfer(accounts[1], '2666', { from: accounts[0] });
    const transferLog = res.logs.find(element => element.event.match('Transfer'));
    assert.strictEqual(transferLog.args.from, accounts[0]);
    assert.strictEqual(transferLog.args.to, accounts[1]);
    assert.strictEqual(transferLog.args.value.toString(), '2666');
  });

  it('events: should fire Transfer event normally on a zero transfer', async () => {
    const res = await token.transfer(accounts[1], '0', { from: accounts[0] });
    const transferLog = res.logs.find(element => element.event.match('Transfer'));
    assert.strictEqual(transferLog.args.from, accounts[0]);
    assert.strictEqual(transferLog.args.to, accounts[1]);
    assert.strictEqual(transferLog.args.value.toString(), '0');
  });

  it('events: should fire Approval event properly', async () => {
    const res = await token.approve(accounts[1], '2666', { from: accounts[0] });
    const approvalLog = res.logs.find(element => element.event.match('Approval'));
    assert.strictEqual(approvalLog.args.owner, accounts[0]);
    assert.strictEqual(approvalLog.args.spender, accounts[1]);
    assert.strictEqual(approvalLog.args.value.toString(), '2666');
  });
});
