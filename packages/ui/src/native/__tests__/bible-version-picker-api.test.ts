import {
  buildSuggestedLanguages,
  fetchAllVersionSummaries,
  fetchSuggestedVersionPickerLanguages,
  fetchVersionLanguageTags,
  fetchVersionPickerLanguages,
  fetchVersionsForLanguage,
  languagesWithBibles,
  type VersionPickerCatalogClients,
} from '../bible-version-picker-api'

describe('bible-version-picker-api', () => {
  const languagesClient = {
    getLanguages: jest.fn(),
  }
  const bibleClient = {
    getVersions: jest.fn(),
  }
  const clients: VersionPickerCatalogClients = { languagesClient, bibleClient }

  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('requests catalog languages with the expected fields', async () => {
    languagesClient.getLanguages.mockResolvedValue({
      data: [
        {
          id: 'en',
          display_names: { en: 'English' },
          speaking_population: 1000,
        },
      ],
    })

    const result = await fetchVersionPickerLanguages(clients)

    expect(languagesClient.getLanguages).toHaveBeenCalledWith({
      fields: ['id', 'display_names', 'speaking_population'],
      page_size: '*',
    })
    expect(result).toEqual([
      {
        id: 'en',
        displayNames: { en: 'English' },
        speakingPopulation: 1000,
      },
    ])
  })

  it('requests suggested languages for country zz', async () => {
    languagesClient.getLanguages.mockResolvedValue({
      data: [{ id: 'es', display_names: { en: 'Spanish' } }],
    })

    const result = await fetchSuggestedVersionPickerLanguages(clients)

    expect(languagesClient.getLanguages).toHaveBeenCalledWith({
      country: 'zz',
      fields: ['id', 'display_names'],
      page_size: '*',
    })
    expect(result).toEqual([{ id: 'es', displayNames: { en: 'Spanish' } }])
  })

  it('requests versions for one language', async () => {
    bibleClient.getVersions.mockResolvedValue({
      data: [
        {
          id: 59,
          title: 'New International Version',
          localized_title: 'New International Version',
          abbreviation: 'NIV',
          localized_abbreviation: 'NIV',
          language_tag: 'en',
          organization_id: '1',
        },
      ],
    })

    const result = await fetchVersionsForLanguage(clients, 'en')

    expect(bibleClient.getVersions).toHaveBeenCalledWith('en', undefined, {
      fields: ['id', 'localized_title', 'localized_abbreviation'],
      page_size: '*',
    })
    expect(result).toEqual([
      {
        id: 59,
        title: 'New International Version',
        localizedTitle: 'New International Version',
        abbreviation: 'NIV',
        localizedAbbreviation: 'NIV',
        languageTag: 'en',
        organizationId: '1',
      },
    ])
  })

  it('requests version language tags with star page size', async () => {
    bibleClient.getVersions.mockResolvedValue({
      data: [{ id: 59, language_tag: 'en' }],
    })

    const result = await fetchVersionLanguageTags(clients)

    expect(bibleClient.getVersions).toHaveBeenCalledWith('*', undefined, {
      fields: ['id', 'language_tag'],
      page_size: '*',
    })
    expect(result.get(59)).toBe('en')
  })

  it('requests all version summaries for recent lookup', async () => {
    bibleClient.getVersions.mockResolvedValue({
      data: [{ id: 59, localized_title: 'New International Version', localized_abbreviation: 'NIV' }],
    })

    const result = await fetchAllVersionSummaries(clients)

    expect(bibleClient.getVersions).toHaveBeenCalledWith('*', undefined, {
      fields: ['id', 'localized_title', 'localized_abbreviation'],
      page_size: '*',
    })
    expect(result).toEqual([
      {
        id: 59,
        title: 'New International Version',
        localizedTitle: 'New International Version',
        abbreviation: 'NIV',
        localizedAbbreviation: 'NIV',
        languageTag: '',
        organizationId: null,
      },
    ])
  })

  it('keeps only languages that have a Bible translation', () => {
    const languages = [
      { id: 'en', displayNames: { en: 'English' } },
      { id: 'xx', displayNames: { en: 'No Bible' } },
    ]
    const tags = new Map<number, string>([[59, 'en']])

    expect(languagesWithBibles(languages, tags)).toEqual([
      { id: 'en', displayNames: { en: 'English' } },
    ])
  })

  it('deduplicates suggested languages in device-then-country order', () => {
    const unique = [
      { id: 'en', displayNames: { en: 'English' } },
      { id: 'es', displayNames: { en: 'Spanish' } },
      { id: 'fr', displayNames: { en: 'French' } },
    ]
    const country = [
      { id: 'en', displayNames: { en: 'English' } },
      { id: 'fr', displayNames: { en: 'French' } },
    ]

    expect(buildSuggestedLanguages(unique, country, ['en'])).toEqual([
      { id: 'en', displayNames: { en: 'English' } },
      { id: 'fr', displayNames: { en: 'French' } },
    ])
  })
})
