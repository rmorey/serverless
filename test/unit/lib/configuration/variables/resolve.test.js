'use strict';

const { expect } = require('chai');

const ServerlessError = require('../../../../../lib/serverless-error');
const resolveMeta = require('../../../../../lib/configuration/variables/resolve-meta');
const resolve = require('../../../../../lib/configuration/variables/resolve');

describe('test/unit/lib/configuration/variables/resolve.test.js', () => {
  describe('Complete resolution', () => {
    const configuration = {
      foo: {
        params: '${sourceParam(param1, param2)}',
        varParam: '${sourceParam(${sourceDirect:})}',
      },
      static: true,
      address: 'foo${sourceAddress:address-result}',
      varAddress: 'foo${sourceAddress:${sourceDirect:}}',
      direct: '${sourceDirect:}',
      property: '${sourceProperty(direct)}',
      otherProperty: '${sourceProperty(varAddress)}',
      deepProperty: '${sourceProperty(foo)}',
      deepPropertyUnrecognized: '${sourceProperty(nestUnrecognized)}',
      deepPropertyErrored: '${sourceProperty(nestErrored)}',
      staticProperty: '${sourceProperty(static)}',
      propertyUnrecognized: '${sourceProperty(nestUnrecognized, unrecognized)}',
      propertyErrored: '${sourceProperty(nestErrored, erroredAddress)}',
      propertyCircularA: '${sourceProperty(propertyCircularB)}',
      propertyCircularB: '${sourceProperty(propertyCircularA)}',
      propertyDeepCircularA: '${sourceProperty(propertyDeepCircularB)}',
      propertyDeepCircularB: '${sourceProperty(propertyDeepCircularC)}',
      propertyDeepCircularC: '${sourceProperty(propertyDeepCircularA)}',
      propertyRoot: '${sourceProperty:}',
      withString: 'foo${sourceDirect:}',
      resolvesVariablesObject: '${sourceVariables(object)}',
      resolvesVariablesArray: '${sourceVariables(array)}',
      resolvesVariablesString: '${sourceVariables(string)}',
      resolvesVariablesStringInvalid: '${sourceVariables(stringInvalid)}',
      incomplete: '${sourceDirect:}elo${sourceIncomplete:}',
      missing: '${sourceDirect:}elo${sourceMissing:}other${sourceMissing:}',
      missingFallback: '${sourceDirect:}elo${sourceMissing:, "foo"}',
      missingFallbackNull: '${sourceMissing:, null}',
      nonStringStringPart: 'elo${sourceMissing:, null}',
      notExistingProperty: "${sourceProperty(not, existing), 'notExistingFallback'}",
      nestUnrecognized: {
        unrecognized:
          '${sourceDirect:}|${sourceUnrecognized:}|${sourceDirect(${sourceUnrecognized:})}' +
          '${sourceDirect:${sourceUnrecognized:}}',
      },
      erroredParam: '${sourceDirect(${sourceError:})}',
      nestErrored: {
        erroredAddress: '${sourceDirect:${sourceError:}}',
      },
      erroredSourceServerlessError: '${sourceError(serverless-error)}',
      erroredSourceNonServerlessError: '${sourceError:}',
      erroredSourceNonErrorException: '${sourceError(non-error-exception)}|',
      invalidResultCircular: '${sourceError(circular-ref)}',
      invalidResultNonJson: '${sourceError(non-json)}',
      invalidResultNonJsonCircular: '|${sourceError(non-json-circular)}',
      infiniteResolutionRecursion: '${sourceInfinite:}',
      invalidResultValue: '${sourceError(no-value)}',
      sharedSourceResolution1: '${sourceShared:}',
      sharedSourceResolution2: '${sourceProperty(sharedSourceResolution1, sharedFinal)}',
      sharedPropertyResolution1: '${sourceSharedProperty:}',
      sharedPropertyResolution2: '${sourceProperty(sharedPropertyResolution1, sharedFinal)}',
    };
    let variablesMeta;
    const sources = {
      sourceParam: {
        resolve: ({ params }) => ({ value: params.join('|') }),
      },
      sourceAddress: {
        resolve: ({ address }) => ({ value: address }),
      },
      sourceDirect: {
        resolve: () => ({ value: 234 }),
      },
      sourceProperty: {
        resolve: async ({ params, resolveConfigurationProperty }) => {
          const result = await resolveConfigurationProperty(params || []);
          return { value: result == null ? null : result };
        },
      },
      sourceVariables: {
        resolve: ({ params: [type] }) => {
          switch (type) {
            case 'object':
              return { value: { foo: '${sourceDirect:}' } };
            case 'array':
              return { value: [1, '${sourceDirect:}'] };
            case 'string':
              return { value: '${sourceDirect:}' };
            case 'stringInvalid':
              return { value: '${sourceDirect:' };
            case 'error':
              return { value: [1, '${sourceUnrecognized:}', '${sourceError:}'] };
            default:
              throw new Error('Unexpected');
          }
        },
      },
      sourceIncomplete: {
        resolve: () => ({ value: null, isPending: true }),
      },
      sourceMissing: {
        resolve: () => ({ value: null }),
      },
      sourceError: {
        resolve: ({ params }) => {
          switch (params && params[0]) {
            case 'non-error-exception':
              throw null; // eslint-disable-line no-throw-literal
            case 'serverless-error':
              throw new ServerlessError('Stop');
            case 'circular-ref': {
              const obj = {};
              obj.obj = obj;
              return { value: obj };
            }
            case 'non-json':
              return { value: new Set() };
            case 'non-json-circular': {
              const obj = new Set();
              obj.obj = obj;
              return { value: obj };
            }
            case 'no-value':
              return {};
            default:
              throw new Error('Stop');
          }
        },
      },

      sourceInfinite: {
        resolve: () => ({ value: { nest: '${sourceInfinite:}' } }),
      },
      sourceShared: {
        resolve: () => ({
          value: {
            sharedFinal: 'foo',
            sharedInner: '${sourceProperty(sharedSourceResolution1, sharedFinal)}',
          },
        }),
      },
      sourceSharedProperty: {
        resolve: () => ({
          value: {
            sharedFinal: 'foo',
            sharedInner: '${sourceProperty(sharedPropertyResolution2)}',
          },
        }),
      },
    };
    before(async () => {
      variablesMeta = resolveMeta(configuration);
      await resolve({
        serviceDir: process.cwd(),
        configuration,
        variablesMeta,
        sources,
        options: {},
        fulfilledSources: new Set(),
      });
    });

    it('should resolve non-string variable', () => {
      expect(configuration.direct).to.equal(234);
    });

    it('should resolve variable concatenated with string value', () => {
      expect(configuration.withString).to.equal('foo234');
    });

    it('should pass params to source resolvers', () => {
      expect(configuration.foo.params).to.equal('param1|param2');
    });

    it('should pass address to source resolvers', () => {
      expect(configuration.address).to.equal('fooaddress-result');
    });

    it('should resolve variables in params', () => {
      expect(configuration.foo.varParam).to.equal('234');
    });

    it('should resolve variables in address', () => {
      expect(configuration.varAddress).to.equal('foo234');
    });

    it('should allow sources to get values of other properties', () => {
      expect(configuration.property).to.equal(234);
      expect(configuration.otherProperty).to.equal('foo234');
      expect(configuration.static).to.equal(true);
      expect(configuration.deepProperty).to.deep.equal({
        params: 'param1|param2',
        varParam: '234',
      });
    });

    it('should support incomplete sources', () => {
      expect(variablesMeta.get('incomplete')).to.have.property('variables');
    });

    it('should mark with error missing source without fallback', () => {
      const valueMeta = variablesMeta.get('missing');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('MISSING_VARIABLE_RESULT');
    });

    it('should support fallback on missing source', () => {
      expect(configuration.missingFallback).to.equal('234elofoo');
    });

    it('should report not existing property with null', () => {
      expect(configuration.notExistingProperty).to.equal('notExistingFallback');
    });

    it('should support `null` fallback on missing source', () => {
      expect(configuration.missingFallbackNull).to.equal(null);
    });

    it('should resolve variables in returned results', () => {
      expect(configuration.resolvesVariablesObject).to.deep.equal({ foo: 234 });
      expect(configuration.resolvesVariablesArray).to.deep.equal([1, 234]);
      expect(configuration.resolvesVariablesString).to.equal(234);
    });

    // https://github.com/serverless/serverless/issues/9016
    it('should resolve same sources across resolution batches without shared caching', () => {
      expect(configuration.sharedSourceResolution1).to.deep.equal({
        sharedFinal: 'foo',
        sharedInner: 'foo',
      });
      expect(configuration.sharedSourceResolution2).to.equal('foo');
    });

    // https://github.com/serverless/serverless/issues/9047
    it('should resolve same properties across resolution batches without shared caching', () => {
      expect(configuration.sharedPropertyResolution1).to.deep.equal({
        sharedFinal: 'foo',
        sharedInner: 'foo',
      });
      expect(configuration.sharedSourceResolution2).to.equal('foo');
    });

    it('should not resolve variables for unrecognized sources', () => {
      expect(variablesMeta.get('nestUnrecognized\0unrecognized')).to.have.property('variables');
    });

    it('should error or non stringifiable value as part of a string', () => {
      const valueMeta = variablesMeta.get('nonStringStringPart');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('NON_STRING_VARIABLE_RESULT');
    });

    it('should mark errored resolution in param with error', () => {
      const valueMeta = variablesMeta.get('erroredParam');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark errored resolution in address with error', () => {
      const valueMeta = variablesMeta.get('nestErrored\0erroredAddress');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark ServerlessError errored resolution with error', () => {
      const valueMeta = variablesMeta.get('erroredSourceServerlessError');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark non ServerlessError errored resolution with error', () => {
      const valueMeta = variablesMeta.get('erroredSourceNonServerlessError');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark non error exception errored resolution with error', () => {
      const valueMeta = variablesMeta.get('erroredSourceNonErrorException');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark json result with circular references with error', () => {
      const valueMeta = variablesMeta.get('invalidResultCircular');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark non json result with error', () => {
      const valueMeta = variablesMeta.get('invalidResultNonJson');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark circular dependency among properties with error', () => {
      const valueMeta = variablesMeta.get('propertyCircularA');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark deep circular dependency among properties with error', () => {
      const valueMeta = variablesMeta.get('propertyDeepCircularA');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should mark property root reference with error', () => {
      const valueMeta = variablesMeta.get('propertyRoot');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should not resolve dependency on unresolved property', () => {
      const valueMeta = variablesMeta.get('deepPropertyUnrecognized');
      expect(valueMeta).to.have.property('variables');
    });

    it('should mark dependency on errored property with error', () => {
      const valueMeta = variablesMeta.get('deepPropertyErrored');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should error on infinite resolution recursion', () => {
      const valueMeta = variablesMeta.get(`infiniteResolutionRecursion${'\0nest'.repeat(10)}`);
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('EXCESSIVE_RESOLVED_PROPERTIES_NEST_DEPTH');
    });

    it('should error on invalid variable notation in returned result', () => {
      const valueMeta = variablesMeta.get('resolvesVariablesStringInvalid');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('UNTERMINATED_VARIABLE');
    });

    it('should error on invalid source resolution resolt', () => {
      const valueMeta = variablesMeta.get('invalidResultValue');
      expect(valueMeta).to.not.have.property('variables');
      expect(valueMeta.error.code).to.equal('VARIABLE_RESOLUTION_ERROR');
    });

    it('should allow to re-resolve fulfilled sources', async () => {
      await resolve({
        serviceDir: process.cwd(),
        configuration,
        variablesMeta,
        sources: { ...sources, sourceIncomplete: { resolve: () => ({ value: 'complete' }) } },
        options: {},
        fulfilledSources: new Set(),
      });
      expect(configuration.incomplete).to.equal('234elocomplete');
    });

    it('should remove from variables meta data on resolved properties', () => {
      expect(Array.from(variablesMeta.keys())).to.deep.equal([
        'deepPropertyUnrecognized',
        'deepPropertyErrored',
        'propertyUnrecognized',
        'propertyErrored',
        'propertyCircularA',
        'propertyCircularB',
        'propertyDeepCircularA',
        'propertyDeepCircularB',
        'propertyDeepCircularC',
        'propertyRoot',
        'resolvesVariablesStringInvalid',
        'missing',
        'nonStringStringPart',
        'nestUnrecognized\0unrecognized',
        'erroredParam',
        'nestErrored\0erroredAddress',
        'erroredSourceServerlessError',
        'erroredSourceNonServerlessError',
        'erroredSourceNonErrorException',
        'invalidResultCircular',
        'invalidResultNonJson',
        'invalidResultNonJsonCircular',
        'invalidResultValue',
        `infiniteResolutionRecursion${'\0nest'.repeat(10)}`,
      ]);
    });
  });

  describe('Partial resolution', () => {
    const configuration = {
      static: true,
      obj: {
        child: 'marko',
      },
      behindVar: '${sourceDirect:}',
      direct: '${sourceProperty(behindVar)}',
      childParent: '${sourceProperty(obj)}',
      parent: {
        parentChild: '${sourceProperty(behindVar)}',
      },
      unresolved: '${sourceProperty(static)}',
    };
    let variablesMeta;
    const sources = {
      sourceDirect: {
        resolve: () => ({ value: 234 }),
      },
      sourceProperty: {
        resolve: async ({ params, resolveConfigurationProperty }) => {
          const result = await resolveConfigurationProperty(params || []);
          return { value: result == null ? null : result };
        },
      },
    };
    before(async () => {
      variablesMeta = resolveMeta(configuration);
      await resolve({
        serviceDir: process.cwd(),
        configuration,
        variablesMeta,
        sources,
        options: {},
        fulfilledSources: new Set(),
        propertyPathsToResolve: new Set(['direct', 'childParent\0child', 'parent']),
      });
    });

    it('should resolve directly pointed property', () => {
      expect(configuration.direct).to.equal(234);
    });
    it('should resolve dependency of pointed property', () => {
      expect(configuration.behindVar).to.equal(234);
    });
    it('should resolve parent of pointed property', () => {
      expect(configuration.childParent.child).to.equal('marko');
    });
    it('should resolve child of pointed property', () => {
      expect(configuration.parent).to.deep.equal({ parentChild: 234 });
    });
    it('should note resolve not pointed properties', () => {
      const valueMeta = variablesMeta.get('unresolved');
      expect(valueMeta).to.have.property('variables');
    });
  });
});
