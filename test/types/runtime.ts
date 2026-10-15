import {
  getMockFor, NodemailerMock, NodemailerMockTransporter, MockSentMessageInfo,
  RealisticMockSentMessageInfo, MockOptions, MockQueuedResult,
} from '../../dist/nodemailer-mock';

const legacy: NodemailerMock = getMockFor();
const legacyTransport: NodemailerMockTransporter = legacy.createTransport();
const legacyResult: Promise<MockSentMessageInfo> = legacyTransport.sendMail({});
const options: MockOptions<'realistic'> = { responseMode: 'realistic', messageIdGenerator: () => '<id@test>' };
const realistic: NodemailerMock<'realistic'> = getMockFor(undefined, options);
const realisticTransport: NodemailerMockTransporter<'realistic'> = realistic.createTransport();
const realisticResult: Promise<RealisticMockSentMessageInfo> = realisticTransport.sendMail({});
realisticTransport.sendMail({}, (_error, info) => {
  const recipients: string[] = info.envelope.to;
  void recipients;
});
realistic.mock.setSentMessageInfo({ envelope: { from: 'a@test', to: ['b@test'] } });
const outcome: MockQueuedResult<'realistic'> = { info: { envelope: { from: 'a@test', to: [] } } };
realistic.mock.queueResult(outcome);
realistic.mock.queueResult({});
realistic.mock.queueResult({ error: new Error('queued') });
realistic.mock.reset({ clearTransporters: true });
legacy.mock.setSentMessageInfo({ envelope: 'legacy-envelope' });
// @ts-expect-error Realistic envelopes must be objects.
realistic.mock.setSentMessageInfo({ envelope: 'legacy-envelope' });
// @ts-expect-error Legacy envelopes must remain strings.
legacy.mock.queueResult({ info: { envelope: { from: 'a@test', to: [] } } });
// @ts-expect-error An outcome cannot be both success and failure.
realistic.mock.queueResult({ error: new Error('queued'), info: { accepted: [] } });
// @ts-expect-error Only supported modes are accepted.
getMockFor(undefined, { responseMode: 'other' });
void legacyResult;
void realisticResult;
