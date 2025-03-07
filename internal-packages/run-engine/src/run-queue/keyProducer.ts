import { MinimalAuthenticatedEnvironment } from "../shared/index.js";
import { EnvDescriptor, RunQueueKeyProducer } from "./types.js";

const constants = {
  CURRENT_CONCURRENCY_PART: "currentConcurrency",
  CONCURRENCY_LIMIT_PART: "concurrency",
  DISABLED_CONCURRENCY_LIMIT_PART: "disabledConcurrency",
  ENV_PART: "env",
  ORG_PART: "org",
  PROJECT_PART: "proj",
  QUEUE_PART: "queue",
  CONCURRENCY_KEY_PART: "ck",
  TASK_PART: "task",
  MESSAGE_PART: "message",
  RESERVE_CONCURRENCY_PART: "reserveConcurrency",
} as const;

export class RunQueueShortKeyProducer implements RunQueueKeyProducer {
  constructor(private _prefix: string) {}

  masterQueueScanPattern(masterQueue: string) {
    return `${this._prefix}*${masterQueue}`;
  }

  queueCurrentConcurrencyScanPattern() {
    return `${this._prefix}{${constants.ORG_PART}:*}:${constants.PROJECT_PART}:*:${constants.ENV_PART}:*:${constants.QUEUE_PART}:*:${constants.CURRENT_CONCURRENCY_PART}`;
  }

  stripKeyPrefix(key: string): string {
    if (key.startsWith(this._prefix)) {
      return key.slice(this._prefix.length);
    }

    return key;
  }

  queueConcurrencyLimitKey(env: MinimalAuthenticatedEnvironment, queue: string) {
    return [this.queueKey(env, queue), constants.CONCURRENCY_LIMIT_PART].join(":");
  }

  envConcurrencyLimitKey(env: EnvDescriptor): string;
  envConcurrencyLimitKey(env: MinimalAuthenticatedEnvironment): string;
  envConcurrencyLimitKey(envOrDescriptor: EnvDescriptor | MinimalAuthenticatedEnvironment): string {
    if ("id" in envOrDescriptor) {
      return [
        this.orgKeySection(envOrDescriptor.organization.id),
        this.projKeySection(envOrDescriptor.project.id),
        this.envKeySection(envOrDescriptor.id),
        constants.CONCURRENCY_LIMIT_PART,
      ].join(":");
    } else {
      return [
        this.orgKeySection(envOrDescriptor.orgId),
        this.projKeySection(envOrDescriptor.projectId),
        this.envKeySection(envOrDescriptor.envId),
        constants.CONCURRENCY_LIMIT_PART,
      ].join(":");
    }
  }

  queueKey(env: MinimalAuthenticatedEnvironment, queue: string, concurrencyKey?: string) {
    return [
      this.orgKeySection(env.organization.id),
      this.projKeySection(env.project.id),
      this.envKeySection(env.id),
      this.queueSection(queue),
    ]
      .concat(concurrencyKey ? this.concurrencyKeySection(concurrencyKey) : [])
      .join(":");
  }

  envQueueKey(env: MinimalAuthenticatedEnvironment) {
    return [this.orgKeySection(env.organization.id), this.envKeySection(env.id)].join(":");
  }

  envQueueKeyFromQueue(queue: string) {
    const { orgId, envId } = this.descriptorFromQueue(queue);
    return [this.orgKeySection(orgId), this.envKeySection(envId)].join(":");
  }

  concurrencyLimitKeyFromQueue(queue: string) {
    const concurrencyQueueName = queue.replace(/:ck:.+$/, "");
    return `${concurrencyQueueName}:${constants.CONCURRENCY_LIMIT_PART}`;
  }

  currentConcurrencyKeyFromQueue(queue: string) {
    return `${queue}:${constants.CURRENT_CONCURRENCY_PART}`;
  }

  currentConcurrencyKey(
    env: MinimalAuthenticatedEnvironment,
    queue: string,
    concurrencyKey?: string
  ): string {
    return [this.queueKey(env, queue, concurrencyKey), constants.CURRENT_CONCURRENCY_PART].join(
      ":"
    );
  }

  disabledConcurrencyLimitKeyFromQueue(queue: string) {
    const { orgId } = this.descriptorFromQueue(queue);
    return `{${constants.ORG_PART}:${orgId}}:${constants.DISABLED_CONCURRENCY_LIMIT_PART}`;
  }

  envConcurrencyLimitKeyFromQueue(queue: string) {
    const { orgId, envId } = this.descriptorFromQueue(queue);
    return `{${constants.ORG_PART}:${orgId}}:${constants.ENV_PART}:${envId}:${constants.CONCURRENCY_LIMIT_PART}`;
  }

  envCurrentConcurrencyKeyFromQueue(queue: string) {
    const { orgId, envId } = this.descriptorFromQueue(queue);
    return `{${constants.ORG_PART}:${orgId}}:${constants.ENV_PART}:${envId}:${constants.CURRENT_CONCURRENCY_PART}`;
  }

  envCurrentConcurrencyKey(env: EnvDescriptor): string;
  envCurrentConcurrencyKey(env: MinimalAuthenticatedEnvironment): string;
  envCurrentConcurrencyKey(
    envOrDescriptor: EnvDescriptor | MinimalAuthenticatedEnvironment
  ): string {
    if ("id" in envOrDescriptor) {
      return [
        this.orgKeySection(envOrDescriptor.organization.id),
        this.envKeySection(envOrDescriptor.id),
        constants.CURRENT_CONCURRENCY_PART,
      ].join(":");
    } else {
      return [
        this.orgKeySection(envOrDescriptor.orgId),
        this.envKeySection(envOrDescriptor.envId),
        constants.CURRENT_CONCURRENCY_PART,
      ].join(":");
    }
  }

  envReserveConcurrencyKey(env: EnvDescriptor): string;
  envReserveConcurrencyKey(env: MinimalAuthenticatedEnvironment): string;
  envReserveConcurrencyKey(
    envOrDescriptor: EnvDescriptor | MinimalAuthenticatedEnvironment
  ): string {
    if ("id" in envOrDescriptor) {
      return [
        this.orgKeySection(envOrDescriptor.organization.id),
        this.envKeySection(envOrDescriptor.id),
        constants.RESERVE_CONCURRENCY_PART,
      ].join(":");
    } else {
      return [
        this.orgKeySection(envOrDescriptor.orgId),
        this.envKeySection(envOrDescriptor.envId),
        constants.RESERVE_CONCURRENCY_PART,
      ].join(":");
    }
  }

  taskIdentifierCurrentConcurrencyKeyPrefixFromQueue(queue: string) {
    const { orgId, projectId } = this.descriptorFromQueue(queue);

    return `${[this.orgKeySection(orgId), this.projKeySection(projectId), constants.TASK_PART]
      .filter(Boolean)
      .join(":")}:`;
  }

  taskIdentifierCurrentConcurrencyKeyFromQueue(queue: string, taskIdentifier: string) {
    return `${this.taskIdentifierCurrentConcurrencyKeyPrefixFromQueue(queue)}${taskIdentifier}`;
  }

  taskIdentifierCurrentConcurrencyKey(
    env: MinimalAuthenticatedEnvironment,
    taskIdentifier: string
  ): string {
    return [
      this.orgKeySection(env.organization.id),
      this.projKeySection(env.project.id),
      constants.TASK_PART,
      taskIdentifier,
    ].join(":");
  }

  projectCurrentConcurrencyKey(env: MinimalAuthenticatedEnvironment): string {
    return [
      this.orgKeySection(env.organization.id),
      this.projKeySection(env.project.id),
      constants.CURRENT_CONCURRENCY_PART,
    ].join(":");
  }

  projectCurrentConcurrencyKeyFromQueue(queue: string): string {
    const { orgId, projectId } = this.descriptorFromQueue(queue);
    return `${this.orgKeySection(orgId)}:${this.projKeySection(projectId)}:${
      constants.CURRENT_CONCURRENCY_PART
    }`;
  }

  messageKeyPrefixFromQueue(queue: string) {
    const { orgId } = this.descriptorFromQueue(queue);
    return `${this.orgKeySection(orgId)}:${constants.MESSAGE_PART}:`;
  }

  messageKey(orgId: string, messageId: string) {
    return [this.orgKeySection(orgId), `${constants.MESSAGE_PART}:${messageId}`]
      .filter(Boolean)
      .join(":");
  }

  orgIdFromQueue(queue: string): string {
    return this.descriptorFromQueue(queue).orgId;
  }

  envIdFromQueue(queue: string): string {
    return this.descriptorFromQueue(queue).envId;
  }

  projectIdFromQueue(queue: string): string {
    return this.descriptorFromQueue(queue).projectId;
  }

  descriptorFromQueue(queue: string) {
    const parts = this.normalizeQueue(queue).split(":");
    return {
      orgId: parts[1].replace("{", "").replace("}", ""),
      projectId: parts[3],
      envId: parts[5],
      queue: parts[7],
      concurrencyKey: parts.at(9),
    };
  }

  private envKeySection(envId: string) {
    return `${constants.ENV_PART}:${envId}`;
  }

  private projKeySection(projId: string) {
    return `${constants.PROJECT_PART}:${projId}`;
  }

  private orgKeySection(orgId: string) {
    return `{${constants.ORG_PART}:${orgId}}`;
  }

  private queueSection(queue: string) {
    return `${constants.QUEUE_PART}:${queue}`;
  }

  private concurrencyKeySection(concurrencyKey: string) {
    return `${constants.CONCURRENCY_KEY_PART}:${concurrencyKey}`;
  }

  private taskIdentifierSection(taskIdentifier: string) {
    return `${constants.TASK_PART}:${taskIdentifier}`;
  }

  // This removes the leading prefix from the queue name if it exists
  private normalizeQueue(queue: string) {
    if (queue.startsWith(this._prefix)) {
      return queue.slice(this._prefix.length);
    }

    return queue;
  }
}
