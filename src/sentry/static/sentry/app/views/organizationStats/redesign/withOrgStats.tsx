import React from 'react';
import {RouteComponentProps} from 'react-router';
import moment from 'moment';

import {Client} from 'app/api';
import {Organization} from 'app/types';

import {OrganizationUsageStats, ProjectUsageStats} from './types';

type InjectedStatsProps = {
  api: Client;
  organization: Organization;

  orgStats?: OrganizationUsageStats;
  orgStatsLoading: boolean;
  orgStatsError?: Error;

  projectStats?: ProjectUsageStats[];
  projectStatsLoading: boolean;
  projectStatsError?: Error;
} & RouteComponentProps<{orgId: string}, {}>;

type State = {
  orgStats?: OrganizationUsageStats;
  orgStatsLoading: boolean;
  orgStatsError?: Error;

  projectStats?: ProjectUsageStats[];
  projectStatsLoading: boolean;
  projectStatsError?: Error;
};

const withOrgStats = <P extends InjectedStatsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  return class extends React.Component<P & InjectedStatsProps, State> {
    state: State = {
      orgStatsLoading: false,
      projectStatsLoading: false,
    };

    componentDidMount() {
      this.getOrganizationStats();
      this.getProjectsStats();
    }

    async getOrganizationStats() {
      const {api, organization} = this.props;

      // TODO: Hardcoded org_slug
      const results = await api.requestPromise(
        `/organizations/${organization.slug}/stats_v2`,
        {
          method: 'GET',
          query: {
            start: moment().subtract(31, 'days').valueOf.toString(),
            end: moment().valueOf().toString(),
            rollup: '1d',
          },
        }
      );

      console.log('from api: ', results);
    }

    /**
     * Fetches aggregated stats of tne entire organization
     */
    _getOrganizationStats() {
      this.setState({orgStatsLoading: true});

      const orgStats: OrganizationUsageStats = {
        statsErrors: [],
        statsTransactions: [],
        statsAttachments: [],
      };

      for (let i = 0; i < 31; i++) {
        const stats = {
          ts: moment().subtract(i, 'days').valueOf().toString(),
          accepted: {timesSeen: 100, quantity: 1000},
          filtered: {timesSeen: 100, quantity: 1000},
          dropped: {
            overQuota: {timesSeen: 100, quantity: 1000},
            spikeProtection: {timesSeen: 100, quantity: 1000},
            other: {timesSeen: 100, quantity: 1000},
          },
        };

        orgStats.statsErrors.push(stats);
        orgStats.statsTransactions.push(stats);
        orgStats.statsAttachments.push(stats);
      }

      setTimeout(() => {
        this.setState({
          orgStatsLoading: false,
          orgStats,
        });
      }, 3000);
    }

    /**
     * Fetches stats of projects that the user has access to
     */
    getProjectsStats() {
      return [];
    }

    render() {
      return <WrappedComponent {...this.props} {...this.state} />;
    }
  };
};

export default withOrgStats;
