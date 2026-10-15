import nodemailer from 'nodemailer';
import {
  getMockFor, NodemailerMocked, NodemailerMock, NodemailerMockTransporter, MockSentMessageInfo,
  RealisticMockSentMessageInfo, MockOptions, MockQueuedResult, MockResponseMode,
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

// Realistic result types require an explicit runtime discriminator.
// @ts-expect-error Realistic options cannot omit responseMode.
const missingMode: MockOptions<'realistic'> = { messageIdGenerator: () => 'fixed' };
// @ts-expect-error An explicit realistic factory mode requires options.
getMockFor<'realistic'>();
// @ts-expect-error A mailer alone cannot select realistic results.
getMockFor<'realistic'>(nodemailer);
// @ts-expect-error Undefined options cannot select realistic results.
getMockFor<'realistic'>(undefined, undefined);
// @ts-expect-error Empty options cannot select realistic results.
getMockFor<'realistic'>(undefined, {});
// @ts-expect-error An explicit realistic constructor mode requires options.
new NodemailerMocked<'realistic'>();
// @ts-expect-error A mailer alone cannot select realistic results.
new NodemailerMocked<'realistic'>(nodemailer);
// @ts-expect-error Undefined options cannot select realistic results.
new NodemailerMocked<'realistic'>(undefined, undefined);
// @ts-expect-error Empty options cannot select realistic results.
new NodemailerMocked<'realistic'>(undefined, {});
void missingMode;

const defaultConstructorResult: Promise<MockSentMessageInfo> = new NodemailerMocked().createTransport().sendMail({});
const ordinaryFactoryResult: Promise<MockSentMessageInfo> = getMockFor(nodemailer).createTransport().sendMail({});
const legacyOptionsResult: Promise<MockSentMessageInfo> =
  getMockFor(undefined, { messageIdGenerator: () => 'id' }).createTransport().sendMail({});
const inferredFactory = getMockFor(nodemailer, { responseMode: 'realistic' });
const inferredConstructor = new NodemailerMocked(nodemailer, { responseMode: 'realistic' });
const typedConstructor = new NodemailerMocked<'realistic'>(undefined, options);
const typedOptionsConstructor = new NodemailerMocked(undefined, options);
const typedOptionsConstructorResult: Promise<RealisticMockSentMessageInfo> =
  typedOptionsConstructor.createTransport().sendMail({});
const explicitDefaultResult: Promise<MockSentMessageInfo> =
  getMockFor(undefined, undefined).createTransport().sendMail({});
const inferredFactoryResult: Promise<RealisticMockSentMessageInfo> = inferredFactory.createTransport().sendMail({});
const inferredConstructorResult: Promise<RealisticMockSentMessageInfo> =
  inferredConstructor.createTransport().sendMail({});
const typedConstructorResult: Promise<RealisticMockSentMessageInfo> = typedConstructor.createTransport().sendMail({});
new NodemailerMocked(nodemailer).createTransport().sendMail({}, (_error, info) => {
  const envelope: string = info.envelope;
  void envelope;
});
inferredConstructor.createTransport().sendMail({}, (_error, info) => {
  const recipients: string[] = info.envelope.to;
  void recipients;
});
const dynamicMode: MockResponseMode = Math.random() > 0.5 ? 'realistic' : 'legacy';
const dynamicOptions: MockOptions<MockResponseMode> = { responseMode: dynamicMode };
const dynamicFactoryResult = getMockFor(nodemailer, dynamicOptions).createTransport().sendMail({});
const dynamicConstructorResult = new NodemailerMocked(nodemailer, dynamicOptions).createTransport().sendMail({});
const dynamicResult: Promise<MockSentMessageInfo | RealisticMockSentMessageInfo> = dynamicFactoryResult;
// @ts-expect-error A dynamic mode cannot promise only legacy results.
const unsafeLegacyFactory: Promise<MockSentMessageInfo> = dynamicFactoryResult;
// @ts-expect-error A dynamic constructor cannot promise only legacy results.
const unsafeLegacyConstructor: Promise<MockSentMessageInfo> = dynamicConstructorResult;
// @ts-expect-error A dynamic mode cannot promise only realistic results.
const unsafeDynamicFactory: Promise<RealisticMockSentMessageInfo> = dynamicFactoryResult;
// @ts-expect-error A dynamic mode cannot promise only realistic results.
const unsafeDynamicConstructor: Promise<RealisticMockSentMessageInfo> = dynamicConstructorResult;
void [defaultConstructorResult, ordinaryFactoryResult, legacyOptionsResult, inferredFactoryResult,
  inferredConstructorResult, typedConstructorResult, typedOptionsConstructorResult, explicitDefaultResult,
  dynamicResult, unsafeDynamicFactory, unsafeDynamicConstructor, unsafeLegacyFactory, unsafeLegacyConstructor];
