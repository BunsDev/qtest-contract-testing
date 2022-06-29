import { Chain } from '../src/chain';
import { generateTapos } from '../src/utils';

describe('account test', () => { 
  const chain = new Chain();
  let account;

  beforeAll(async () => {
    await chain.setupChain(false);
    account = await chain.createAccount('testaccount1');
  }, 60000);

  it ('test update auth', async () => {
    await account.updateAuth('testauth', 'active', 2, 
    [{
      key: 'EOS7Gk5QTRcKsK5grAuZkLyPTSw5AcQpCz2VDWGi5DPBvfZAG7H9b',
      weight: 1
    },{
      key: 'EOS8cFt6PzBL79kp9vPwWoX8V6cjwgShbfUsyisiZ1M8QaFgZtep6',
      weight: 1
    }],
    [{
      permission: {
        actor: 'acc11.test',
        permission: 'eosio.code'
      },
      weight: 2
    }]);
    const accountInfo = await chain.rpc.get_account(account.name);
    expect(accountInfo.permissions[2].perm_name).toBe('testauth');
    expect(accountInfo.permissions[2].required_auth.threshold).toBe(2);
    expect(accountInfo.permissions[2].required_auth.keys[0].key).toBe('EOS7Gk5QTRcKsK5grAuZkLyPTSw5AcQpCz2VDWGi5DPBvfZAG7H9b');
    expect(accountInfo.permissions[2].required_auth.keys[0].weight).toBe(1);
    expect(accountInfo.permissions[2].required_auth.keys[1].key).toBe('EOS8cFt6PzBL79kp9vPwWoX8V6cjwgShbfUsyisiZ1M8QaFgZtep6');
    expect(accountInfo.permissions[2].required_auth.keys[1].weight).toBe(1);
    expect(accountInfo.permissions[2].required_auth.accounts[0].permission.actor).toBe('acc11.test');
    expect(accountInfo.permissions[2].required_auth.accounts[0].permission.permission).toBe('eosio.code');
    expect(accountInfo.permissions[2].required_auth.accounts[0].weight).toBe(2);
  }, 100000);

  it ('test add auth', async () => {
    await account.addAuth('addauth11111', 'testauth');
    const accountInfo = await chain.rpc.get_account(account.name);
    const activePermission = accountInfo.permissions.find(p => p.perm_name === 'addauth11111');
    expect(activePermission.perm_name).toBe('addauth11111');
    expect(activePermission.required_auth.threshold).toBe(1);
    expect(activePermission.required_auth.keys[0].key).toBe('EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV');
    expect(activePermission.required_auth.keys[0].weight).toBe(1);
    expect(activePermission.required_auth.accounts).toEqual([]);
  }, 100000);

  it ('test add code', async () => {
    await account.addCode('newcodeauth'); // add code for not exist permission
    let accountInfo = await chain.rpc.get_account(account.name);
    const newlyAddedPermission = accountInfo.permissions.find(p => p.perm_name === 'newcodeauth');

    expect(newlyAddedPermission.perm_name).toBe('newcodeauth');
    expect(newlyAddedPermission.required_auth.threshold).toBe(1);
    expect(newlyAddedPermission.required_auth.accounts[0].permission.actor).toBe(account.name);
    expect(newlyAddedPermission.required_auth.accounts[0].permission.permission).toBe('eosio.code');
    expect(newlyAddedPermission.required_auth.accounts[0].weight).toEqual(1);

    await chain.accounts[0].addCode('active'); // add code for active permssion
    accountInfo = await chain.rpc.get_account(chain.accounts[0].name);
    const activePermission = accountInfo.permissions.find(p => p.perm_name === 'active');
    expect(activePermission.perm_name).toBe('active');
    expect(activePermission.required_auth.threshold).toBe(1);
    expect(activePermission.required_auth.keys[0].key).toBe('EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV');
    expect(activePermission.required_auth.keys[0].weight).toBe(1);
    expect(activePermission.required_auth.accounts[0].permission.actor).toBe(chain.accounts[0].name);
    expect(activePermission.required_auth.accounts[0].permission.permission).toBe('eosio.code');
    expect(activePermission.required_auth.accounts[0].weight).toEqual(1);

    await expect(chain.accounts[0].addCode('active')).rejects.toThrowError('Already set code for this account') // add code for active permssion again
  }, 100000);

  it ('test link auth', async () => {
    const transaction = await account.linkAuth('eosio.token', 'transfer', 'addauth11111');

    expect(transaction.processed.action_traces[0].act.account).toBe('eosio');
    expect(transaction.processed.action_traces[0].act.name).toBe('linkauth');
    
    const transferTransaction = await chain.api.transact({ // should able to transfer with addauth11111 permission
      actions: [
        {
          account: 'eosio.token',
          name: 'transfer',
          authorization: [
            {
              actor: account.name,
              permission: 'addauth11111',
            },
          ],
          data: {
            from: account.name,
            to: 'acc11.test',
            quantity: '0.10000000 WAX',
            memo: 'test'
          },
        }
      ],
    },
      generateTapos()
    );

    expect(transferTransaction.processed.action_traces[0].act.account).toBe('eosio.token');
    expect(transferTransaction.processed.action_traces[0].act.name).toBe('transfer');
  }, 100000);

  it ('test transfer core token', async () => {
    const senderBalanceBefore = await account.getBalance();
    const transaction = await account.transfer('acc11.test', '1.00000000 WAX', 'abc test');
    const senderBalanceAfter = await account.getBalance();
    expect(transaction.processed.block_num).toBeGreaterThan(0);
    expect(senderBalanceBefore - 1).toBe(senderBalanceAfter);
  }, 100000);

  it ('set contract', async () => {
    const contractAccount = chain.accounts[1];
    const contract = await contractAccount.setContract('./testContract/build/testcontract.wasm', './testContract/build/testcontract.abi');
    let transaction = await chain.pushAction({
      account: contractAccount.name,
      name: 'hello',
      authorization: [{
        actor: contractAccount.name,
        permission: 'active'
      }],
      data: {
        name: contractAccount.name
      }
    });
    // @ts-ignore
    expect(transaction.processed.action_traces[0].console).toBe(' hello ' + contractAccount.name);

    transaction = await contract.action.hello({ name: contractAccount.name }); // push action with contract instance
    expect(transaction.processed.action_traces[0].console).toBe(' hello ' + contractAccount.name);
  }, 100000);
});