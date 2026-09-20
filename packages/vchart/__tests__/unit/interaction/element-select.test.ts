import { DataSet, DataView } from '@visactor/vdataset';
import type { ISeriesOption } from '../../../src/series/interface';
import { PieSeries, registerPieSeries } from '../../../src/series/pie/pie';
import type { IPieSeriesSpec } from '../../../src/series/pie/interface';
import { ElementSelect } from '../../../src/interaction/triggers/element-select';
import { Interaction } from '../../../src/interaction/interaction';
import { TRIGGER_TYPE_ENUM } from '../../../src/interaction/triggers/enum';
import type { IMark } from '../../../src/mark/interface';
import type { IMarkGraphic } from '../../../src/mark/interface/common';
import { initChartDataSet, seriesOption } from '../../util/context';

registerPieSeries();

const dataSet = new DataSet();
initChartDataSet(dataSet);

class TestPieSeries extends PieSeries<IPieSeriesSpec> {
  protected _computeLayoutRadius() {
    return 100;
  }
}

const dummyEvent = {
  on: () => undefined,
  off: () => undefined,
  emit: () => undefined
};

function createPieSeries(spec: Partial<IPieSeriesSpec> = {}) {
  const dataView = new DataView(dataSet);
  dataView.parse(
    [
      { type: 'oxygen', value: 46.6 },
      { type: 'silicon', value: 27.72 },
      { type: 'aluminum', value: 8.13 }
    ],
    {
      type: 'array'
    }
  );

  const series = new TestPieSeries(
    {
      type: 'pie',
      data: dataView,
      valueField: 'value',
      categoryField: 'type',
      ...spec
    },
    seriesOption({ dataSet }) as ISeriesOption
  );
  series.created();
  series.init({});
  return series;
}

function getSelectTriggers(series: PieSeries<IPieSeriesSpec>) {
  return series.getInteractionTriggers().filter(item => item.trigger.type === TRIGGER_TYPE_ENUM.ELEMENT_SELECT);
}

function createGraphic(mark: IMark): IMarkGraphic {
  return {
    context: { markId: mark.id },
    currentStates: [] as string[],
    hasState(state: string) {
      return this.currentStates.includes(state);
    },
    setStates(states?: string[] | null) {
      this.currentStates = states ?? [];
    }
  } as unknown as IMarkGraphic;
}

function startSelects(
  selectTriggers: ReturnType<typeof getSelectTriggers>,
  graphics: IMarkGraphic[]
) {
  const instances = selectTriggers.map(({ trigger, marks }) => {
    const interaction = new Interaction();
    const instance = new ElementSelect({
      ...(trigger as any),
      marks,
      event: dummyEvent,
      interaction
    });
    return { interaction, instance };
  });

  graphics.forEach(graphic => {
    instances.forEach(({ instance }) => instance.start(graphic));
  });

  return instances.map(({ interaction, instance }) => interaction.getStatedGraphics(instance) ?? []);
}

describe('element-select vs default select', () => {
  test('interactions isMultiple accumulates without default single-select fighting it', () => {
    const series = createPieSeries({
      interactions: [
        {
          type: 'element-select',
          isMultiple: true
        }
      ]
    });

    const triggers = series.getInteractionTriggers();
    const selectTriggers = getSelectTriggers(series);

    expect(selectTriggers).toHaveLength(1);
    expect(selectTriggers[0].trigger.isMultiple).toBe(true);
    expect(triggers.some(item => item.trigger.type === TRIGGER_TYPE_ENUM.DIMENSION_HOVER)).toBe(true);
    expect(triggers.some(item => item.trigger.type === TRIGGER_TYPE_ENUM.ELEMENT_HIGHLIGHT)).toBe(true);

    const mark = selectTriggers[0].marks[0];
    const statedLists = startSelects(selectTriggers, [createGraphic(mark), createGraphic(mark)]);

    expect(statedLists.some(graphics => graphics.length > 1)).toBe(true);
  });

  test('default select without interactions stays single-select', () => {
    const series = createPieSeries();
    const selectTriggers = getSelectTriggers(series);

    expect(selectTriggers).toHaveLength(1);
    expect(selectTriggers[0].trigger.isMultiple).toBe(false);

    const mark = selectTriggers[0].marks[0];
    const statedLists = startSelects(selectTriggers, [createGraphic(mark), createGraphic(mark)]);

    expect(statedLists[0]).toHaveLength(1);
  });

  test('select.mode multiple still accumulates without interactions', () => {
    const series = createPieSeries({
      select: {
        mode: 'multiple'
      }
    });
    const selectTriggers = getSelectTriggers(series);

    expect(selectTriggers).toHaveLength(1);
    expect(selectTriggers[0].trigger.isMultiple).toBe(true);

    const mark = selectTriggers[0].marks[0];
    const statedLists = startSelects(selectTriggers, [createGraphic(mark), createGraphic(mark)]);

    expect(statedLists[0].length).toBeGreaterThan(1);
  });
});
