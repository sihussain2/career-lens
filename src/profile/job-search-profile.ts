export interface JobSearchProfile {
  id: string;

  targetRoles: string[];

  technologies: string[];

  domains: string[];

  workArrangement: Array<
    "remote" |
    "hybrid" |
    "onsite"
  >;

  locations: string[];

  salaryPreferences?: {
    minimumBase?: number;
    currency?: string;
  };

  otherPreferences: string[];

  updatedAt: string;
}
