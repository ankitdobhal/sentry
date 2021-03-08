import React from 'react';
import {RouteComponentProps} from 'react-router';

import {OrganizationUsageStats, ProjectUsageStats} from './types';

type InjectedStatsProps = {
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

    /**
     * Fetches aggregated stats of tne entire organization
     */
    getOrganizationStats() {
      this.setState({orgStatsLoading: true});

      const orgStats: OrganizationUsageStats = {
        statsErrors: [],
        statsTransactions: [],
        statsAttachments: [],
      };

      for (let i = 0; i < 31; i++) {
        const stats = {
          ts: i.toString(),
          accepted: {timesSeen: i * 100, quantity: i * 1000},
          filtered: {timesSeen: i * 100, quantity: i * 1000},
          dropped: {
            overQuota: {timesSeen: i * 100, quantity: i * 1000},
            spikeProtection: {timesSeen: i * 100, quantity: i * 1000},
            other: {timesSeen: i * 100, quantity: i * 1000},
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
