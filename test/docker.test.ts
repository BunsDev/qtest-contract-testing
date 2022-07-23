import {
  startChainContainer,
  getContainers,
  killExistingChainContainer,
  getChainIp,
} from '../src/dockerClient';

describe('docker client test', () => {
  let port = 12345;
  it('start chain container', async () => {
    await startChainContainer(port);

    const containers = getContainers();
    const qTestContainer = containers.find((c) => c.name === 'qtest12345');
    // @ts-ignore
    expect(qTestContainer.name).toBe('qtest12345');
  });

  it('get chain ip', async () => {
    const ip = await getChainIp(port);

    const ipFragment = ip.split('.');
    expect(ipFragment.length).toBe(4);
    expect(isNaN(Number(ipFragment[0]))).toBe(false);
  });

  it('kill chain container', async () => {
    await killExistingChainContainer(port);
    const containers = getContainers();
    const qTestContainer = containers.find((c) => c.name === 'qtest12345');
    expect(qTestContainer).toBe(undefined);
  });
});
