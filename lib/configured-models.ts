import prisma from './prisma';

export type GatewayProvider = 'anthropic' | 'openai' | 'custom';

export type ConfiguredModelRecord = {
	id: string;
	name: string;
	gatewayId: string;
	gatewayName: string;
	provider: GatewayProvider;
	modelId: string;
	executionEngine?: 'api-chat' | 'api-tools';
	supportsTools?: boolean;
	createdAt: string;
	updatedAt: string;
};

const MODELS_SETTING_KEY = 'configured_models';

export function parseJsonConfig(config: unknown): Record<string, any> {
	if (!config) return {};
	if (typeof config !== 'string') return config as Record<string, any>;
	try {
		return JSON.parse(config);
	} catch {
		return {};
	}
}

function normalizeProvider(provider: unknown): GatewayProvider {
	return provider === 'anthropic' || provider === 'custom' ? provider : 'openai';
}

export async function readConfiguredModels(): Promise<ConfiguredModelRecord[]> {
	const setting = await prisma.setting.findUnique({ where: { key: MODELS_SETTING_KEY } });
	if (!setting) return [];
	try {
		const parsed = JSON.parse(setting.value);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export async function resolveAgentModel(agent: { type: string; model: string; config: unknown }) {
	const config = parseJsonConfig(agent.config);
	const configuredModels = await readConfiguredModels();
	const configuredModelId = typeof config.configuredModelId === 'string' ? config.configuredModelId : '';
	const configuredGatewayId = typeof config.gatewayId === 'string' ? config.gatewayId : '';

	let configuredModel = configuredModelId
		? configuredModels.find((model) => model.id === configuredModelId)
		: undefined;

	if (!configuredModel) {
		const modelMatches = configuredModels.filter((model) =>
			model.provider === agent.type && model.modelId === agent.model
		);
		configuredModel = configuredGatewayId
			? modelMatches.find((model) => model.gatewayId === configuredGatewayId) || modelMatches[0]
			: modelMatches[0];
	}

	if (!configuredModel && configuredGatewayId) {
		configuredModel = configuredModels.find((model) =>
			model.gatewayId === configuredGatewayId && model.modelId === agent.model
		);
	}

	return {
		config,
		configuredModel,
		gatewayId: configuredModel?.gatewayId || configuredGatewayId || undefined,
		modelId: configuredModel?.modelId || agent.model,
		provider: normalizeProvider(configuredModel?.provider || agent.type),
	};
}
